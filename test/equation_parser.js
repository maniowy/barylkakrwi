const assert = require('assert');

const config = {data:require('../config/data.json'), confidential:require('../config/confidential.json')};
const logger = require('simple-node-logger').createSimpleLogger();
const barylka = require('../server/barylka.js')(config, logger);

describe('EquationParser', function() {
  describe('testForCurrentVolume', function() {
    it('should parse basic input', function() {
      const input = [
        ['295700 - 450 = 295250', 295250],
        ['298910-450=298460', 298460],
        ['299910-1000 = 298910', 298910],
        ['300360-450= 299910', 299910],
        ['300810-450 =300360', 300360],
        ['301260- 450 = 300810', 300810],
        ['301710- 450=301260', 301260],
        ['302160- 450= 301710', 301710],
        ['302610- 450 =302160', 302160],
        ['303060 -450 = 302610', 302610],
        ['303720 -210=303510', 303510],
        ['304170 -450= 303720', 303720],
        ['304620 -450 =304170', 304170],
        [' 305120  -  500  =  304620 ', 304620]
      ];
      for (i of input) {
        assert.equal(barylka.testForCurrentVolume(i[0]), i[1]);
      }
    });
    it('should parse input with spaces', function() {
      const input = [
        ['295250 - 450 = 294 800', 294800],
        ['296 150-450 = 295 700', 295700],
        ['296 800-650=296 150', 296150],
        ['303 510 - 450=303 060', 303060],
        ['306250- 450 = 305 800', 305800],
        ['315 290- 450= 314 840', 314840],
        ['315 740- 450 =315 290', 315290],
        ['316 640-450= 316 190', 316190],
        ['317 090-450 =316 640', 316640],
        ['317 540 - 450= 317 090', 317090],
        ['317 990 - 450 =317 540', 317540],
      ];
      for (i of input) {
        assert.equal(barylka.testForCurrentVolume(i[0]), i[1]);
      }
    });
    it('should accept input with long dash (ascii 8212)', function() {
      const input = [
        ['318 650 — 650 = 318 000', 318000]
      ];
      for (i of input) {
        assert.equal(barylka.testForCurrentVolume(i[0]), i[1]);
      }
    });
    it('should accept corrections', function() {
      const input = [
        ['317 550 + 440 = 317 990', 317990],
        ['Aktualny wynik: 322 750', 322750],
        ['Korekta. Aktualny wynik: 325100', 325100]
      ];
      for (i of input) {
        assert.equal(barylka.testForCurrentVolume(i[0]), i[1]);
      }
    });
    it('should accept negative result', function() {
      const input = [
        ['1020 - 650 - 650 - 650 = -930', -930]
      ];
      for (i of input) {
        assert.equal(barylka.testForCurrentVolume(i[0]), i[1]);
      }
    });
  });
});
