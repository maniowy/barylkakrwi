module.exports = function(config, logger) {
  let module = {}
  module.composeEquation = (lastVolume, currentVolumes) => {
    const volume = lastVolume > 0 ? lastVolume : config.data.volume;
    const newVolume = volume - currentVolumes.reduce((acc, cur) => acc + cur, 0);
    const equation = `${volume} - ${currentVolumes.join(" - ")} = ${newVolume}`;
    return equation.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }
  return module;
}
