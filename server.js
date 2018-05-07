#!/usr/bin/env node
'use strict';
const http = require('http')
    , fs = require('fs')
    , path = require('path')
    , url = require('url');
const ADDR = '127.0.0.1', PORT = 9090;
const PEM_PATH = __dirname + '/pems/';
const WEBAPPS = __dirname + '/webapp/';

function error(err, response) {
    console.error(err);
    response.statusCode = 500;
    return response.end('error\n');
}

function notFound(response) {
    response.statusCode = 404;
    response.end('Not found\n');
}

function newSync() {
    const cache = new Map();
    return (key, resolve) => {
        const onFinally = () => cache.delete(key);

        function apply() {
            cache.set(key, new Promise(done => {
                resolve(done);
            }).then(
                x => new Promise(resolve => resolve(onFinally())).then(() => x),
                e => new Promise(resolve => resolve(onFinally())).then(() => {
                    throw e;
                })
            ));
        }

        const p = cache.get(key);
        p ? p.then(apply) : setTimeout(apply);
    };
}

const sync = newSync();
const pathMap = {
    '': 'index.html'
};
const mineMap = {
    'default': 'application/octet-stream',
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8'
};

http.createServer((request, response) => {
    let {pathname, query} = url.parse(request.url, true);
    if (pathname[0] != '/') {
        return notFound(response);
    }
    pathname = pathname.substr(1);
    if (!pathname) {
        let accept = request.headers['accept'];
        let json = 'application/json';
        if (typeof accept === 'string' && accept.substr(0, json.length).toLowerCase() === json) {
            fs.readdir(PEM_PATH, (err, files) => {
                if (err) {
                    return error(err);
                }
                let {page = 0, limit = 100} = query;
                page = Math.max(0, (+page || 0) >> 0);
                let offset = page * limit;
                limit = Math.max(20, Math.min(+limit || 100, 1000));
                files = files.filter(file => /(\w+\.pem)/.test(file));
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify({
                    page, offset, limit,
                    data: files.slice(offset, offset + limit),
                    total: files.length
                }));
            });
            return;
        }
    }
    if (/\w+\.pem/.test(pathname)) {
        sync(pathname, done => {
            fs.readFile(PEM_PATH + pathname, (err, data) => {
                if (err) {
                    done();
                    return notFound(response);
                }
                response.setHeader('Content-Type', 'application/pkix-cert');
                response.end(data);
                fs.unlink(PEM_PATH + pathname, done);
            });
        });
    } else {
        pathname = path.normalize(pathMap[pathname] || pathname);
        if (/(\.\.|[\\/])/.test(pathname)) {
            return notFound(response);
        }
        let contentType = mineMap[pathname.substr(pathname.lastIndexOf('.') + 1)] || mineMap['default'];
        fs.readFile(WEBAPPS + pathname, (err, data) => {
            if (err) {
                return notFound(response);
            }
            response.setHeader('Content-Type', contentType);
            response.end(data);
        });
    }
}).listen(PORT, ADDR);
