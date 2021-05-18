let storage = { removedFiles: [], mainImage: 0 };

function retrieveCurrentVolume(onReady) {
  let XHR = new XMLHttpRequest();
  XHR.responseType="text";
  XHR.open('GET', `${urlPrefix}/latest`);
  XHR.onload = () => {
      const response = JSON.parse(XHR.response);
      const volume = response["volume"];
      onReady(volume);
  }
  XHR.send();
}

function updatePhotos() {
  storage.removedFiles = [];
  const files = document.getElementById("photoSelector")?.files;
  let fileName = document.querySelector("#inputform .file-name");
  if (files.length > 0) {
    fileName.textContent = [...files].map(f => f.name).join(', ');
  } else {
    fileName.textContent = "Wybierz zdjęcie";
  }
  let spc = document.getElementById("selectorPreviewContainer");
  while (spc.firstElementChild) {
    spc.removeChild(spc.firstElementChild);
  }
  for (i = 0; i < files.length; i++) {
    if (!files[i].type.startsWith('image/')) { continue; }
    let div = document.createElement("div");
    let img = document.createElement("img");
    div.appendChild(img);
    div.setAttribute('file_id', i);
    let span = document.createElement("span");
    span.classList.add("selectorImageDismiss");
    let icon = document.createElement("i");
    icon.classList.add("fas");
    icon.classList.add("fa-times-circle");
    icon.classList.add("fa-2x");
    span.onclick = removeImage;
    span.appendChild(icon);
    div.appendChild(span);
    spc.appendChild(div);
    img.onclick = changeMainImage;
    let reader = new FileReader();
    reader.onload = e => img.setAttribute("src", e.target.result);
    reader.readAsDataURL(files[i]);
  }
  if (files.length > 1) {
    spc.children[0].firstElementChild.classList.add('mainImage');
    storage.mainImage = 0;
  }
}

function changeMainImage(event) {
  let spc = document.getElementById("selectorPreviewContainer");
  for (i of spc.children) {
    i.firstElementChild.classList.remove('mainImage');
  }
  let img = event.target;
  img.classList.add('mainImage');
  storage.mainImage = parseInt(img.parentElement.getAttribute('file_id'));
}

function removeImage(event) {
  const div = event.currentTarget.parentElement
  storage.removedFiles.push(div.getAttribute('file_id'));
  let container = div.parentElement;
  container.removeChild(div);
  if (container.childElementCount && ![...container.children].filter(c => c.firstElementChild.classList.contains('mainImage')).length) {
    container.children[0].firstElementChild.classList.add('mainImage');
    storage.mainImage = 0;
  }
  // FIXME update file names
}

function scaleVolume(volume, kind) {
  if (kind.match(/^osocze/)) {
    return Math.floor(volume/30)*10
  }
  return volume;
}

function collectFormData() {
  const dateItems = document.getElementsByClassName("donationDate");
  const idsDatesMap = new Map([...dateItems].map(d => [parseInt(d.getAttribute("donationId")), d.value]));
  const donations = [...dateItems].map(d => {
      const id = parseInt(d.getAttribute("donationId"));
      const date = d.value;
      const kind = document.getElementById(`kind_${id}`)?.selectedOptions[0].innerText;
      const volume = scaleVolume(parseInt(document.getElementById(`volume_${id}`)?.value), kind);
      const site = document.getElementById(`site_${id}`)?.selectedOptions[0].innerText;
      const city = document.getElementById(`city_${id}`)?.value;
      const abroad = document.getElementById(`abroad_${id}`)?.checked;
      const abroadCity = document.getElementById(`abroad_city_${id}`)?.value
      const bus = document.getElementById(`busdonation_${id}`)?.checked
      let donation = {id : id,
          date: date,
          kind: kind,
          volume: volume,
          site: site,
          city: city,
          abroad: abroad,
          abroadCity: abroadCity,
          bus: bus
      };
      return donation
  });
  const group = document.getElementById("group")?.selectedOptions[0].innerText;
  const privateCounter = parseInt(document.getElementById("privateCounter")?.value);
  const orders = Array.from(document.getElementById("orders")?.children).filter(c => c.firstElementChild?.children[1].checked).map(l => l.firstElementChild.firstElementChild.innerText);
  const msg = document.getElementById("message")?.value;
  const adultmedia = document.getElementById("adult")?.checked;
  return {
      donations: donations,
      group: group,
      privateCounter: privateCounter,
      orders: orders,
      msg: msg,
      adultmedia: adultmedia
  }
}

function submitForm() {
  let form = document.getElementById("inputform");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  let button = document.getElementById("submit");
  button.classList.add('is-loading');
  button.disabled = true;

  let request = collectFormData();

  const fd = new FormData();
  fd.append("body", JSON.stringify(request));
  let files = [...document.getElementById("photoSelector")?.files];
  [files[0], files[storage.mainImage]] = [files[storage.mainImage], files[0]];
  for (i = 0; i < files.length; i++) {
    if (!files[i].type.startsWith('image/') || storage.removedFiles.includes(`${i}`)) { continue; }
    fd.append('embed', files[i]);
  }

  fetch(`${urlPrefix}/addEntry`, {
      method: 'POST',
      body: fd
  })
    .then(res => {
        console.log(`Received response: `, res);
        if (res.status == 200) {
            res.text().then(txt => {
                console.log(txt)
                const data = JSON.parse(txt);
                console.log(`id: ${data.id}`);
                window.location.replace(`${urlPrefix}/thankyou/${data.id}`)
            });
        }
        else if (res.status == 401) {
            console.error("unauthorized");
            res.text().then(txt => console.error(txt));
        } else if (res.status >= 400) {
            res.text().then(txt => {
                console.error(txt);
                popupError(txt);
            });
        }
        if (res.status != 200) {
            button.disabled = false;
            button.classList.remove('is-loading');
        }
    })
    .then(html => console.log(html))
    .catch(err => console.error(err));
}

function requestPreview(onReady, onError) {
  let request = collectFormData();

  const fd = new FormData();
  fd.append("body", JSON.stringify(request));

  fetch(`${urlPrefix}/preview`, {
      method: 'POST',
      body: fd
  })
    .then(res => {
        console.log(`Received response: `, res);
        if (res.status == 200) {
            res.text().then(txt => {
                if (onReady) {
                    onReady(JSON.parse(txt))
                }
                else {
                    console.log(txt)
                }
        });
        }
        else if (res.status == 401) {
            console.error("unauthorized");
            res.text().then(txt => console.error(txt));
            onError();
        } else if (res.status >= 400) {
            res.text().then(txt => {
                console.error(txt);
                popupError(txt);
                onError();
            });
        }
    })
    .then(html => console.log(html))
    .catch(err => console.error(err));
}

function showPreview() {
  let form = document.getElementById("inputform");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  let button = document.getElementById("previewButton");
  button.classList.add('is-loading');
  button.disabled = true;

  const activateButton = function() {
      button.disabled = false;
      button.classList.remove('is-loading');
  }

  requestPreview(response => {
      const out = document.getElementById("previewOutput");
      out.innerText = response.body;
      const links = [...out.innerText.matchAll(/\[(.*?)\]\((.*?)\)/g)];
      for (l of links) {
        out.innerHTML = out.innerHTML.replace(l[0], `<a href="${l[2]}" target="_blank">${l[1]}</a>`);
      }
      const imgs = document.getElementById("previewImages");
      while (imgs.firstChild) {
          imgs.removeChild(imgs.firstChild);
      }
      let files = [...document.getElementById("photoSelector")?.files];
      [files[0], files[storage.mainImage]] = [files[storage.mainImage], files[0]];
      for (i = 0; i < files.length; i++) {
          if (!files[i].type.startsWith('image/') || storage.removedFiles.includes(`${i}`)) { continue; }
          const div = document.createElement('div');
          const img = document.createElement('img');
          img.classList.add('obj');
          img.file = files[i];
          div.appendChild(img);
          imgs.appendChild(div);

          if (i) {
            let span = document.createElement('span');
            span.innerText += "Komentarz " + i;
            div.prepend(span);
          }

          const reader = new FileReader();
          reader.onload = ((aImg) => { return function(e) { aImg.src = e.target.result; }; })(img);
          reader.readAsDataURL(files[i]);
      }
      let preview = document.getElementById("preview");
      preview.classList.add('is-active');
      activateButton();
  }, activateButton);
}

function hidePreview() {
  let preview = document.getElementById("preview");
  preview.classList.remove('is-active');
}

function onPlasmaVolumeChange(id) {
  console.debug(`onPlasmaVolumeChange: ${id}`);
  let volume = document.getElementById(`volume_${id}`);
  let volumeParent = volume.parentElement.parentElement;
  let descriptionBox = volumeParent.children[1];
  let desc = descriptionBox.firstElementChild.firstElementChild;
  desc.innerText = `= ${scaleVolume(parseInt(volume.value), "osocze")} ml KP`;
}

function onDonationKindChange(id) {
  let volume = document.getElementById(`volume_${id}`);
  const kind = document.getElementById(`kind_${id}`);
  volume.value = configData.kinds[kind.selectedIndex].vol
  volume.max = configData.kinds[kind.selectedIndex].max
  volume.setAttribute('onchange', null);

  let volumeParent = volume.parentElement.parentElement;
  if (kind.selectedIndex == 0) {
    volumeParent.classList.remove("has-addons");
    volumeParent.children[1].classList.add("is-hidden");
    volume.parentElement.title = "Objętość oddanej krwi pełnej"
    volume.readOnly = false;
  } else {
    volumeParent.classList.add("has-addons");
    let descriptionBox = volumeParent.children[1];
    descriptionBox.classList.remove("is-hidden");
    let desc = descriptionBox.firstElementChild.firstElementChild
    if (kind.selectedOptions[0].innerText.match(/^osocze/)) {
      desc.innerText = `= ${scaleVolume(parseInt(volume.value), "osocze")} ml KP`;
      desc.classList.remove("is-hidden");
      volume.parentElement.title = "Rzeczywista objętość oddanego osocza";
      volume.setAttribute('onchange', `onPlasmaVolumeChange(${id})`);
      volume.readOnly = false;
    } else {
      desc.innerText = "";
      desc.classList.add("is-hidden");
      volume.parentElement.title = "Objętość składników krwi przeliczona na krew pełną";
      volume.readOnly = true;
    }
  }
}

// https://krwiodawcy.org/gdzie-mozna-oddac-krew
// http://www.wckik.pl/ekipy.php, http://www.wckik.pl/wawa.php
// http://ckikmsw.pl/e-krew/
function onSiteChange(id) {
    let city = document.getElementById(`city_${id}`);
    const site = document.getElementById(`site_${id}`);
    const siteConfig = configData.sites[site.selectedIndex];
    let newCity = undefined;
    if (siteConfig.cities) {
        newCity = document.createElement("select");
        city.parentElement.classList.remove("control");
        city.parentElement.classList.add("select");
        newCity.replaceChildren(...siteConfig.cities.map(x => {
            let opt = document.createElement("option");
            opt.innerText = x;
            return opt;
        }));
    } else {
        newCity = document.createElement("input");
        newCity.classList.add("input");
        city.parentElement.classList.remove("select");
        city.parentElement.classList.add("control");
    }
    newCity.id = city.id;
    city.replaceWith(newCity);
}

function onAbroadChange(id) {
  const abroad = document.getElementById(`abroad_${id}`);
  const city = document.getElementById(`abroad_city_${id}`);
  let bus = document.getElementById(`busdonation_${id}`);
  if (abroad.checked) {
    city.disabled = false;
    city.focus();
    bus.checked = false;
  }
  else {
    city.disabled = true;
  }
}

function onBusDonationChange(id) {
  const bus = document.getElementById(`busdonation_${id}`);
  let abroad = document.getElementById(`abroad_${id}`);
  if (bus.checked) {
      abroad.checked = false;
      onAbroadChange(id);
  }
}

function today() {
  const now = new Date();
  return now.toISOString().match(/(\d{4}-\d{2}-\d{2})T.*/)[1];
}

// FIXME try to copy last donation & modify ID
async function createDonation() {
  Array.from(document.getElementsByClassName("createButton"))
    .forEach( b => b.classList.add("is-loading") );
  let donations = document.getElementsByClassName("donation");
  let len = donations.length;
  let id = parseInt(donations[len-1].getAttribute("donationId")) + 1;
  let XHR = new XMLHttpRequest();
  XHR.open('GET', `${urlPrefix}/donation/${id}`);
  XHR.responseType="text";
  XHR.onload = () => {
    donations[len-1].insertAdjacentHTML("afterend", XHR.response);
    let crs = Array.from(document.getElementsByClassName("createButton"));
    crs.forEach( b => {
      b.classList.remove("is-loading");
      b.classList.add("is-hidden");
    });
    crs[crs.length - 1].classList.remove("is-hidden");
    let dates = document.getElementsByClassName("donationDate");
    const t = today();
    dates[len].max = t;
    dates[len].value = t;
  }
  XHR.send();
}

function deleteDonation(id) {
  if (!id) {
    return;
  }
  let donation = document.getElementById(`donation_${id}`);
  if (donation) {
    donation.remove();
    let crs = Array.from(document.getElementsByClassName("createButton"));
    crs[crs.length - 1].classList.remove("is-hidden");
  }
}

function popupError(message) {
  let errorOutput = document.getElementById("errorOutput");
  errorOutput.innerText = message;
  let error = document.getElementById("error");
  error.classList.add('is-active');
}

function dismissError() {
  let error = document.getElementById("error");
  error.classList.remove('is-active');
}

function popupDescription() {
  let description = document.getElementById("description");
  description.classList.add('is-active');
}

function hideDescription() {
  let description = document.getElementById("description");
  description.classList.remove('is-active');
}

