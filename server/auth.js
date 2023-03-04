const {url} = require('url');

module.exports = (config, logger) => {
    let module = {}

    const secure = require('./secure.js')(config, logger);

    const WykopAPI = require('./wykop.js')(logger);
    WykopAPI.provideSecrets(config.confidential);

    module.verify = (req, res, next) => {
        const noConnect = ["/latest"].includes(req.path);

        const urlPrefix = config?.server?.urlprefix ?? "";
        
        let rtoken = req.cookies?.userData?.rt;
        let token = req.locals?.token; 
        if (rtoken == undefined) {
            rtoken = req.query.rtoken;
            token = req.query.token;
            delete req.query.rtoken;
            delete req.query.token;

            if (rtoken) {
                logger.trace("Wykop token (query): ", token);
                logger.trace("Wykop rtoken (query): ", rtoken);

                refreshToken(rtoken, req, res, next);
            }
            else if (noConnect) {
                next();
            } else {
                logger.debug("No refresh token provided");
                logger.debug("Redirecting to: ", `${urlPrefix}/connect`)
                //const url = new URL(`${urlPrefix}/connect`)
                //url.searchParams = new URLSearchParams(req.query);
                //next(gUrl.format({pathname:`${urlPrefix}/connect`, query:req.query}))
                connect(req, res, next);
            }
        }
        else if (token === undefined) {
            refreshToken(secure.decrypt(rtoken), req, res, next);
        }
        else {
            next();
        }
    }

    function connect(req, res, next) {
        // const protocol = req.protocol;
        // TODO failure path
        WykopAPI.getToken((token) => {
          logger.debug("Auth token: ", token);
          WykopAPI.connectUrl(token, (url) => {
            logger.debug("redirecting to: ", url);
            res.redirect(url);
          });
        });
        // FIXME error handling
    }

    function refreshToken(rtoken, req, res, next) {
        WykopAPI.refreshToken(rtoken, (token, rtoken) => {
            req.locals ??= {};
            req.locals.token = token

            if (req.cookies.userData === undefined) {
                WykopAPI.userProfile(token, (username) => {
                    logger.info("User logged in: ", username);
                    const cryptoToken = secure.encrypt(rtoken);
                    res.cookie('userData', {login: username, rt: cryptoToken},
                    { maxAge: 24*60*60*1000, httpOnly: true, secure: true, sameSite: 'Strict'});
                    next();
                }, err => {
                    if (err?.code && err?.error && err?.error?.message) {
                        res.status(err.code).send(err.error.message);
                    } else {
                        const protectors = config.serverData.protectors.map(p => `@${p}`).join(", ")
                        res.status(500).send(`Przepraszamy, wystąpił nieokreślony błąd.\nSkontaktuj się z ${protectors} lub innymi opiekunami tagu.`);
                    }
                });
            }
            else {
                next();
            }
        });
    }
    
    return module;
}