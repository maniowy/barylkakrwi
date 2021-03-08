const assert = require('assert');
const config = {data:require('../config/data.json')};
const logger = require('simple-node-logger').createSimpleLogger();
const barylka = require('../server/barylka.js')(config, logger);

describe('Equation', function() {
  it('should delimit thousands', function() {
    const input = {last: 137450, volumes:[450, 1000]};
    assert.equal(barylka.composeEquation(input.last, input.volumes),
      "137 450 - 450 - 1 000 = 136 000");
  });
  it('should start new edition when last result is less or equal to zero', function() {
    const newEdition = "328 000 - 450 = 327 550";
    const input = [
      {last: 0, volumes: [450]},
      {last: -100, volumes: [450]}
    ];
    for (i of input) {
      assert.equal(barylka.composeEquation(i.last, i.volumes), newEdition);
    }
  });
  it('should allow negative results', function() {
    const data = [
      {last: 150, volumes: [450], result: "150 - 450 = -300"},
      {last: 150, volumes: [450, 500], result: "150 - 450 - 500 = -800"}
    ];
    for (d of data) {
      assert.equal(barylka.composeEquation(d.last, d.volumes), d.result);
    }
  });
});
