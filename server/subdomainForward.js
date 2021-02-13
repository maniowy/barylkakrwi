// credits: https://stackoverflow.com/questions/54791634/subdomain-host-based-routing-in-express
module.exports =
  (subdomainHosts, customRouter) => {
    return (req, res, next) => {
      let host = req.headers.host ? req.headers.host : ''; // requested hostname is provided in headers
      host = host.split(':')[0]; // removing port part

      // checks if requested host exist in array of custom hostnames
      const isSubdomain = (host && subdomainHosts.includes(host));
      if (isSubdomain) { // yes, requested host exists in provided host list
        // call router and return to avoid calling next below
        // yes, router is middleware and can be called
        return customRouter(req, res, next);
      }

      // default behavior
      next();
    }
  };
