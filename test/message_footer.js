const assert = require('assert');

const config = {
  data:require('../config/data.json'),
  server:require('../config/server.json'),
  confidential:require('../config/confidential.json')
};
const logger = require('simple-node-logger').createSimpleLogger();
const barylka = require('../server/barylka.js')(config, logger);

describe('MessageFooter', function() {
  it('should inform on the entry source', function() {

    const pref = config.server.urlprefix ? `/${config.server.urlprefix}` : "";
    assert.ok(barylka.getFooter().startsWith(`Wpis został dodany za pomocą [tego skryptu](${config.server.url}${pref})`));
  });

  it('should provide important links', function() {
    config.server.urlprefix = "skrypt";
    let esc = (s) => s.replace(/[./]/g, '\\$&');
    const url = esc(config.server.url);
    const pref = config.server.urlprefix ? `/${config.server.urlprefix}` : "";
    const uri = `${url}${esc(pref)}`;
    assert.ok(barylka.getFooter().match(new RegExp(`\\[Dodaj wpis\\]\\(${uri}\\)`)));
    assert.ok(barylka.getFooter().match(new RegExp(`\\[Regulamin\\]\\(${url}\/regulamin\\)`)));
    // FIXME put the example url in the config
    assert.ok(barylka.getFooter().match(/\[Wzór wpisu\]\(https:\/\/www\.wykop\.pl\/wpis\/49653241\)/));
    assert.ok(barylka.getFooter().match(new RegExp(`\\[Strona akcji\\]\\(${url}\\)`)));
  });

  //it('should be attached to message', function() {
  //});

});
