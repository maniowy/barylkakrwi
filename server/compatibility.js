function internetExplorer(req, logger) {
  const userAgent = req.headers['user-agent'];
  logger.debug(`User agent: ${userAgent}`);
  return userAgent.indexOf("MSIE ") > 0 || !!userAgent.match(/Trident.*rv\:11\./);
}

module.exports = function(req, res, logger) {
  if (internetExplorer(req, logger)) {
    res.render('not-supported', {
      title: 'Baryłka krwi',
      basedir: 'public'
    });
    return false;
  }
  return true
}
