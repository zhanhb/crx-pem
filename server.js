#!/usr/bin/env node
'use strict';
const http = require('http')
    , fs = require('fs')
    , url = require('url');
const ADDR = '127.0.0.1', PORT = 9090;
const PEM_PATH = __dirname + '/pems/';

function error(err, response) {
    console.error(err);
    response.statusCode = 500;
    return response.end('error');
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

http.createServer((request, response) => {
    let {path, query} = url.parse(request.url, true);
    if (path == '/') {
        fs.readdir(PEM_PATH, (err, files) => {
            if (err) {
                return error(err);
            }
            files = files.filter(file => /(\w+\.pem)/.test(file));
            if (files.length) {
                response.setHeader('Content-Type', 'text/html; charset=utf-8');
                response.write(`<style>a{padding: 10px;5px;float: left;}</style>`);
                files.forEach(file => response.write(`<a href='${file}'>${file.replace(/\.pem$/, '')}</a>`));
                response.end();
            } else {
                response.setHeader('Content-Type', 'text/plain');
                response.end('No pem files.');
            }
        });
    } else if (path[0] != '/' || !/(\w+\.pem)/.test(path = path.substr(1))) {
        return notFound(response);
    } else {
        sync(path, done => {
            fs.readFile(PEM_PATH + path, (err, data) => {
                if (err) {
                    done();
                    return notFound(response);
                }
                response.setHeader('Content-Type', 'application/pkix-cert');
                response.end(data);
                fs.unlink(PEM_PATH + path, done);
            });
        });
    }
}).listen(PORT, ADDR);
