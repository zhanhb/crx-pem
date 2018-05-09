#!/usr/bin/env node
'use strict';
const http = require('http')
    , fs = require('fs')
    , url = require('url')
    , express = require('express');

const HOST = '127.0.0.1', PORT = 9090;
const PEM_PATH = __dirname + '/pems';

(function () {
    if (typeof Promise.prototype.finally !== 'function') {
        let speciesConstructor = function (O, defaultConstructor) {
            if (!O || (typeof O !== 'object' && typeof O !== 'function')) {
                throw new TypeError('Assertion failed: Type(O) is not Object');
            }
            let C = O.constructor;
            if (typeof C === 'undefined') {
                return defaultConstructor;
            }
            if (!C || (typeof C !== 'object' && typeof C !== 'function')) {
                throw new TypeError('O.constructor is not an Object');
            }
            let S = typeof Symbol === 'function' && typeof Symbol.species === 'symbol' ? C[Symbol.species] : undefined;
            if (S == null) {
                return defaultConstructor;
            }
            if (typeof S === 'function' && S.prototype) {
                return S;
            }
            throw new TypeError('no constructor found');
        }, then = Promise.prototype.then;

        let shim = {
            finally(onFinally) {
                let promise = this;
                if (typeof promise !== 'object' || promise === null) {
                    throw new TypeError('"this" value is not an Object');
                }
                let C = speciesConstructor(promise, Promise); // throws if SpeciesConstructor throws
                if (typeof onFinally !== 'function') {
                    return then.call(promise, onFinally, onFinally);
                }
                return then.call(
                    promise,
                    x => new C(resolve => resolve(onFinally())).then(() => x),
                    // keep original stack trace
                    e => new C(resolve => resolve(onFinally())).then(() => new Promise((resolve, reject) => reject(e)))
                );
            }
        };
        Object.defineProperty(Promise.prototype, 'finally', {configurable: true, writable: true, value: shim.finally});
    }
})();

const fsPromise = function () {
    let keys = ['readdir', 'readFile', 'unlink'], obj = {};
    for (let key of keys) {
        obj[key] = function (file) {
            return new Promise((resolve, reject) => {
                fs[key](file, (err, result) => {
                    err ? reject(err) : resolve(result);
                });
            });
        }
    }
    return obj;
}();

function newSync() {
    const cache = new Map();
    return (key, resolve) => {
        function apply() {
            cache.set(key, new Promise(done => {
                resolve(done);
            }).finally(() => cache.delete(key)));
        }

        const p = cache.get(key);
        p ? p.then(apply) : setTimeout(apply);
    };
}

const sync = newSync();

const webapp = express.static('webapp');

const notFound = express.Router().all('*', function (request, response) {
    response.statusCode = 404;
    switch (request.accepts(['json', 'text'])) {
        case 'json':
            response.json({
                path: request.url,
                message: 'Not found'
            });
            break;
        case 'text':
            response.end('Not found\n');
    }
});

let F;

const dynamic = express().get('/', function (request, response, next) {
    if (request.accepts(['json', 'html']) === 'json') {
        const {query} = url.parse(request.url, true);
        (F || (F = fsPromise.readdir(PEM_PATH).finally(() => {
            F = undefined;
        }))).then(files => {
            let {page = 0, limit = 100} = query;
            page = Math.max(0, (+page || 0) >> 0);
            let offset = page * limit;
            limit = Math.max(20, Math.min(+limit || 100, 1000));
            files = files.filter(file => /\w+\.pem/.test(file));
            response.json({
                page, offset, limit,
                data: files.slice(offset, offset + limit),
                total: files.length
            });
        }, err => {
            console.error(err);
            response.statusCode = 500;
            return response.end('error\n');
        });
        return;
    }
    next();
});

const pems = express.Router().get(/^\/\w+\.pem$/, function (request, response, next) {
    let {pathname} = url.parse(request.url);
    sync(pathname, done => {
        let path = PEM_PATH + pathname;
        fsPromise.readFile(path).then(data => {
            response.setHeader('Content-Type', 'application/pkix-cert');
            response.end(data);
            fs.unlink(path, done);
        }, () => {
            done();
            next();
        });
    });
});

express().use(dynamic, pems, webapp, notFound).listen(PORT, HOST);
