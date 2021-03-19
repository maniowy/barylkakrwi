module.exports = function(config, logger) {
  let module = {}

  const WykopAPI = require('./wykop.js')(logger);
  WykopAPI.provideSecrets(config.confidential);

  module.composeEquation = (lastVolume, currentVolumes) => {
    const volume = lastVolume > 0 ? lastVolume : config.data.volume;
    const newVolume = volume - currentVolumes.reduce((acc, cur) => acc + cur, 0);
    const equation = `${volume} - ${currentVolumes.join(" - ")} = ${newVolume}`;
    return equation.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  module.testForCurrentVolume = (body) => {
    let countdown = body.match(/[0-9 ]*.*[-—+].*[0-9 ]*.*=(.*)/);
    if (countdown && countdown.length > 1) {
      const volume = parseInt(countdown[1].trim().replace(/\s/g, ''));
      if (!isNaN(volume)) {
        return volume;
      }
    }
    countdown = body.toLowerCase().match(/.*?aktualny wynik[: a-z-]*([0-9 ]*)/);
    if (countdown && countdown.length > 1) {
      const volume = parseInt(countdown[1].trim().replace(/\s/g, ''));
      if (!isNaN(volume)) {
        return volume;
      }
    }
    return Number.NaN;
  }

  module.retrievePage = (id, onResult) => {
    WykopAPI.retrievePage(config.data.tag, id, onResult);
  }

  module.retrieveCurrentVolume = (user, onResult) => {
    let retriever = (id) => {
      let currentVolume = null;
      module.retrievePage(id, (entries) => {
        const data = entries.data;
        if (!data) {
          this.logger.error("Failed to retrieve page");
          return;
        }
        for (let e of data) {
          const volume = module.testForCurrentVolume(e.body);
          if (!isNaN(volume)) {
            currentVolume = volume;
            break;
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

  return module;
}
