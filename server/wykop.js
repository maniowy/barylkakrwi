const http = require('https');
const md5 = require('md5');
//const querystring = require('querystring');
const axios = require('axios');
const qs = require('qs');
const FormData = require('form-data');
const fs = require('fs');

function postAxios(url, data, header, logger) {
    const dataStr = (typeof data == 'string' ? data : JSON.stringify(data));
    logger.debug(`postAxios: ${url} ${dataStr.slice(0,300)} ${header?JSON.stringify(header).slice(0,300):""}`);
    if (data && typeof data != 'string') {
        logger.debug(`post params: ${[...Object.keys(data)]}`);
    }

    const options = {
        method: 'POST',
        headers: header
    };
    logger.trace(`options: `, options);

    return new Promise((resolve, reject) => {
        axios.post(url, data, {headers: header})
            .then((res) => {
                if (res.data.data == null) {
                    if (res.data.error) {
                        reject(res.data.error);
                    }
                    else {
                        reject(res)
                    }
                    //} else if (urlParams[0].toLowerCase() == 'login') {
                    //	this.userKey = res.data.data.userkey;
                    //	resolve(res.data);
                } else {
                    resolve(res.data);
                }
            })
            .catch((err) => reject(err));
    });
}

class Wykop {
    constructor(logger) {
        this.baseUrl = "https://a2.wykop.pl";
        this.queries = {
            connect: "/login/connect",
            login: "/Login/Index",
            tags: "/Tags/Entries/barylkakrwi",
            appKey: "/appkey/",
            userKey: "/userkey/",
            clearOutput: "/output/clear"
        }
        this.urlParams = {
            connect: ["login", "connect"],
            login: ["Login", "Index"],
            addEntry: ["Entries", "Add"],
            tags: ["Tags"]
        }
        this.logger = logger;
    }
    provideSecrets(confidential) {
        this.appKey = confidential.appkey;
        this.secret = confidential.secret;
    }

    createUrlArgs(urlParams, apiParams, namedParams) {
        const baseUrl = `${this.baseUrl}/${urlParams.join('/')}`;
        let apiParamsJoined = "";
        if (apiParams) {
            apiParmsJoined = `/${apiParms.join('/')}`;
        }
        let namedParamsJoined = "";
        if (namedParams) {
            namedParamsJoined = Object.entries(namedParams).map(([key, value]) => `/${key}/${value}`).join('');
        }
        let ukey = "";
        if (this.userKey) {
            ukey = `${this.queries.userKey}${this.userKey}`;
        }
        return `${baseUrl}${apiParamsJoined}${namedParamsJoined}${this.queries.appKey}${this.appKey}${ukey}`;
    }

    createUrl(options) {
        return this.createUrlArgs(options.urlParams, options.apiParams, options.namedParams);
    }

    connectUrl(redirect) {
        const b64 = Buffer.from(redirect).toString('base64');
        const encoded = encodeURI(b64);
        //let url = `${this.baseUrl}${this.queries.connect}${this.queries.appKey}${this.appKey}/redirect/${encoded}/secure/${this.sign(redirect)}`;
        return this.createUrl({urlParams: this.urlParams.connect, namedParams: {redirect:encoded, secure: this.sign(redirect)}});
    }

    entryUrl(id) {
        return `https://www.wykop.pl/wpis/${id}`;
    }

    login(login, accountKey, callback) {
        const url = this.createUrl({
            urlParams: this.urlParams.login
        });

        const data = {login: login, accountkey: accountKey};
        this.logger.info("login data: ", data);

        //const dataStr = querystring.stringify(data);
        const dataStr = qs.stringify(data);
        const apisign = this.sign(url, data);
        this.logger.trace(`apisign: ${apisign}`);

        postAxios(url, dataStr, {
            apisign: apisign,
            'Content-Type': 'application/x-www-form-urlencoded'
        }, this.logger).then((res) => {
            this.logger.info("Received response: ", res);
            callback(200, res);
        }).catch((err) => this.logger.error("Failure: ", err));
    }

    sign(url, post) {
        this.logger.log(`sign: ${url}`, (post ? JSON.stringify(post).slice(0,150) : ""));
        let postString = ''
        if (post) {
            if (Array.isArray(post)) {
                postString = post.join();
            }
            else if (post instanceof Map) {
                postString = [...post.values()].join();
            }
            else if (post instanceof String) {
                postString = post;
            }
            else {
                postString = Object.keys(post).map(key => post[key]).join();
            }
        }
        let value = `${this.secret}${url}${postString}`;
        this.logger.trace(`signing: ${value.slice(0,150)}`);
        return md5(value);
        //return md5(decodeURI(value));
    }

    getPageRequestUrl(id) {
        return this.createUrl({urlParams: this.urlParams.tags, namedParams: {Entries: 'barylkakrwi', page: id, output: 'clear'}});
    }

    retrievePage(id, onResult) {
        const url = this.getPageRequestUrl(id);
        axios.get(url, {headers: {apisign: this.sign(url)}})
            .then(res => onResult(res.data))
            .catch((err) => this.logger.error(err));
    }

    retrieveCurrentVolume(user, onResult) {
        let retriever = (id) => {
            let currentVolume = null;
            this.retrievePage(id, (entries) => {
                const data = entries.data;
                if (!data) {
                    this.logger.error("Failed to retrieve page");
                    return;
                }
                for (let e of data) {
                    // FIXME unit tests
                    let countdown = e.body.match(/[0-9 ]*.*[-—+].*[0-9 ]*.*=.*?([0-9 ]*)/);
                    if (countdown && countdown.length > 1) {
                        const volume = parseInt(countdown[1].trim().replace(/\s/g, ''));
                        if (!isNaN(volume)) {
                            currentVolume = volume;
                            break;
                        }
                    }
                    countdown = e.body.toLowerCase().match(/.*?aktualny wynik[: a-z-]*([0-9 ]*)/);
                    if (countdown && countdown.length > 1) {
                        const volume = parseInt(countdown[1].trim().replace(/\s/g, ''));
                        if (!isNaN(volume)) {
                            currentVolume = volume;
                            break;
                        }
                    }
                }
                if (currentVolume) {
                    onResult(currentVolume);
                    return;
                }
                if (id < 10) {
                    retriever(id+1);
                }
                else {
                    this.logger.error(`Failed to retrieve result, tried first ${id} pages`);
                }
            });
        };
        retriever(1);
    }

    async addEntry(request, file, onResult) {
        this.logger.debug(`addEntry request: `, request);
        const url = this.createUrl({
            urlParams: this.urlParams.addEntry
        });
        this.logger.trace("add entry url: ", url);

        const data = request;
        const apisign = this.sign(url, data);
        this.logger.trace(`apisign: ${apisign}`);

        const dataStr = qs.stringify(data);
        const fd = new FormData();
        if (file && file.embed) {
            let d;
            for (d in data) {
                fd.append(d, data[d]);
            }
            fd.append('embed', fs.createReadStream(file.embed.path));
        } else {
            this.logger.trace("add entry data:", dataStr.slice(0,300));
        }

        const contentType = ((file && file.embed)
            ? fd.getHeaders()['content-type']
            : 'application/x-www-form-urlencoded');

        let options = {
            apisign: apisign,
            'User-Agent': 'barylkakrwi',
            'Content-Type': contentType
        };

        if (file && file.embed) {
            let resolver;
            let promise = new Promise((resolve, reject) => { resolver = resolve});
            fd.getLength((err, length) => {
                options['Content-Length'] = length;
                resolver();
            });
            await promise;
        }

        postAxios(url,
            (file&&file.embed ? fd : dataStr),
            options,
            this.logger).then((res) => {
              this.logger.info("Received response: ", res);
              onResult(res);
        }).catch((err) => this.logger.error("Failure: ", err));
    }
}

module.exports = function(logger) {
    return new Wykop(logger);
};
// module.exports = Wykop
