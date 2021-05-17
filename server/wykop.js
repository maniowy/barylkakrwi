const http = require('https');
const md5 = require('md5');
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
        this.urlParams = {
            connect: ["login", "connect"],
            login: ["Login", "Index"],
            addEntry: ["Entries", "Add"],
            addEntryComment: ["Entries", "CommentAdd"],
            tags: ["Tags"],
            appKey: ["appkey"],
            userKey: ["userkey"]
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
            ukey = `/${this.urlParams.userKey.join()}/${this.userKey}`;
        }
        return `${baseUrl}${apiParamsJoined}${namedParamsJoined}/${this.urlParams.appKey.join()}/${this.appKey}${ukey}`;
    }

    createUrl(options) {
        return this.createUrlArgs(options.urlParams, options.apiParams, options.namedParams);
    }

    connectUrl(redirect) {
        const b64 = Buffer.from(redirect).toString('base64');
        const encoded = encodeURI(b64);
        return this.createUrl({urlParams: this.urlParams.connect, namedParams: {redirect:encoded, secure: this.sign(redirect)}});
    }

    entryUrl(id) {
        return `https://www.wykop.pl/wpis/${id}`;
    }

    login(login, accountKey, onSuccess, onError) {
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
            onSuccess(200, res);
        }).catch((err) => {
            this.logger.error("Failure: ", err);
            onError(err);
        });
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
        const value = `${this.secret}${url}${postString}`;
        this.logger.trace(`signing: ${value.slice(0,150)}`);
        return md5(value);
    }

    getPageRequestUrl(tagName, pageId) {
        return this.createUrl({urlParams: this.urlParams.tags, namedParams: {Entries: tagName, page: pageId, output: 'clear'}});
    }

    retrievePage(tagName, id, onResult) {
        const url = this.getPageRequestUrl(tagName, id);
        axios.get(url, {headers: {apisign: this.sign(url)}})
            .then(res => onResult(res.data))
            .catch((err) => this.logger.error(err));
    }

    async addEntryCommon(url, request, file, onResult, onError) {
        this.logger.debug(`addEntryCommon request: `, request);
        this.logger.trace("addEntryCommon url: ", url);

        const data = request;
        const apisign = this.sign(url, data);
        this.logger.trace(`apisign: ${apisign}`);

        const dataStr = qs.stringify(data);
        const fd = new FormData();
        if (file) {
            let d;
            for (d in data) {
                fd.append(d, data[d]);
            }
            fd.append('embed', fs.createReadStream(file.path));
        } else {
            this.logger.trace("add entry data:", dataStr.slice(0,300));
        }

        const contentType = (file
            ? fd.getHeaders()['content-type']
            : 'application/x-www-form-urlencoded');

        let options = {
            apisign: apisign,
            'User-Agent': 'barylkakrwi',
            'Content-Type': contentType
        };

        if (file) {
            let resolver;
            let promise = new Promise((resolve, reject) => { resolver = resolve});
            fd.getLength((err, length) => {
                options['Content-Length'] = length;
                resolver();
            });
            await promise;
        }

        postAxios(url,
            (file ? fd : dataStr),
            options,
            this.logger).then((res) => {
              this.logger.info("Received response: ", res);
              onResult(res);
        }).catch((err) => {
            this.logger.error("Failure: ", err);
            onError(err);
        });
    }

    async addEntry(request, file, onResult, onError) {
        this.logger.debug(`addEntry request: `, request);
        const url = this.createUrl({
            urlParams: this.urlParams.addEntry
        });
        this.addEntryCommon(url, request, file, onResult, onError);
    }

    async addEntryComment(entryId, request, file, onResult, onError) {
        this.logger.debug(`addEntryComment request: `, request);
        const url = this.createUrl({
            urlParams: this.urlParams.addEntryComment.concat(entryId)
        });
        this.addEntryCommon(url, request, file, onResult, onError);
    }
}

module.exports = function(logger) {
    return new Wykop(logger);
};
