function switchToNightMode() {
  let body = document.body;
  body.classList.remove("daylight");
  body.classList.add("nightmode");
}

function switchToDaylight() {
  let body = document.body;
  body.classList.remove("nightmode");
  body.classList.add("daylight");
}

function today() {
  const now = new Date();
  return now.toISOString().match(/(\d{4}-\d{2}-\d{2})T.*/)[1];
}

async function adjustView() {
    const now = new Date();
    const hour = now.getHours();
    if (hour > 16 || hour < 8) {
        switchToNightMode();
    }
}
adjustView();

async function adjustDateRange() {
    for (d of document.getElementsByClassName("donationDate")) {
        const t = today();
        d.max = t;
        d.value = t;
    }
}
adjustDateRange();

async function updateProgressBar() {
    let spinner = document.getElementById("progressBarSpinner");
    let meter = document.createElement("progress");
    meter.classList.add("progress");
    meter.id = "progressBar";
    let text = document.getElementById("percentText");
    retrieveCurrentVolume((volume) => {
        const full = configData.volume;
        meter.value = (full - volume)/full;
        meter.title = `${full - volume} / ${full} ml\nPozostało ${volume} ml`;
        spinner.replaceWith(meter);
        text.innerText = ` ${Math.round((100*meter.value + Number.EPSILON)*100)/100}%`
    });
}
updateProgressBar();

async function disableDefaultSubmit() {
    document.getElementById('inputform')?.
        addEventListener('submit', event => event.preventDefault());
}
disableDefaultSubmit();
