let storage = {
  files: [],
  mainImage: 0
};
function retrieveCurrentVolume(onReady) {
  let XHR = new XMLHttpRequest();
  XHR.responseType = "text";
  XHR.open('GET', `${urlPrefix}/latest`);
  XHR.onload = () => {
    const response = JSON.parse(XHR.response);
    const volume = response["volume"];
    onReady(volume);
  };
  XHR.send();
}
function updatePhotos(event) {
  let photoSelector = document.getElementById("photoSelector");
  const files = [...photoSelector.files].filter(f => {
    return f.type.startsWith('image/') && !storage.files.map(f => f.name).includes(f.name);
  });
  const idxStart = storage.files.length;
  storage.files = storage.files.concat(new Array(files.length));
  let spc = document.getElementById("selectorPreviewContainer");
  for (i = 0; i < files.length; i++) {
    let div = document.createElement("div");
    let img = document.createElement("img");
    div.appendChild(img);
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
    storage.files[i + idxStart] = files[i];
    reader.readAsDataURL(files[i]);
  }
  for (i = 0; i < spc.childElementCount; i++) {
    spc.children[i].setAttribute('file_id', i);
  }
  if (spc.childElementCount > 1 && ![...spc.children].filter(c => c.firstElementChild.classList.contains('mainImage')).length) {
    spc.children[0].firstElementChild.classList.add('mainImage');
    storage.mainImage = 0;
  }
  photoSelector.files = new DataTransfer().files;
  photoSelector.required = storage.files.length == 0;
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
  const div = event.currentTarget.parentElement;
  storage.files.splice(div.getAttribute('file_id'), 1);
  let spc = div.parentElement;
  spc.removeChild(div);
  for (i = 0; i < spc.childElementCount; i++) {
    spc.children[i].setAttribute('file_id', i);
  }
  if (spc.childElementCount > 0 && ![...spc.children].filter(c => c.classList.contains('mainImage')).length) {
    spc.children[0].firstElementChild.classList.add('mainImage');
    storage.mainImage = 0;
  }
  let selector = document.getElementById("photoSelector");
  selector.required = storage.files.length == 0;
}
function scaleVolume(volume, kind) {
  if (kind.match(/^osocze/)) {
    return Math.floor(volume / 30) * 10;
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
    const abroadCity = document.getElementById(`abroad_city_${id}`)?.value;
    const bus = document.getElementById(`busdonation_${id}`)?.checked;
    let donation = {
      id: id,
      date: date,
      kind: kind,
      volume: volume,
      site: site,
      city: city,
      abroad: abroad,
      abroadCity: abroadCity,
      bus: bus
    };
    return donation;
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
  };
}
function validate() {
  let form = document.getElementById("inputform");
  if (!form.checkValidity()) {
    form.reportValidity();
    return false;
  }
  return true;
}
function submitForm(params) {
  if (!validate()) {
    return;
  }
  let button = document.getElementById("submit");
  button.classList.add('is-loading');
  button.disabled = true;
  let request = collectFormData();
  const fd = new FormData();
  fd.append("body", JSON.stringify(request));
  fd.append("params", JSON.stringify(params));
  let files = storage.files;
  let indices = [storage.mainImage];
  indices = indices.concat([...files.keys()].filter(k => k != storage.mainImage));
  for (i of indices) {
    fd.append('embed', files[i]);
  }
  fetch(`${urlPrefix}/addEntry`, {
    method: 'POST',
    body: fd
  }).then(res => {
    console.log(`Received response: `, res);
    if (res.status == 200) {
      res.text().then(txt => {
        console.log(txt);
        const data = JSON.parse(txt);
        console.log(`id: ${data.id}`);
        window.location.replace(`${urlPrefix}/thankyou/${data.id}`);
      });
    } else if (res.status == 401) {
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
  }).then(html => console.log(html)).catch(err => console.error(err));
}
function requestPreview(params, onReady, onError) {
  let request = collectFormData();
  const fd = new FormData();
  fd.append("body", JSON.stringify(request));
  fd.append("params", JSON.stringify(params));
  fetch(`${urlPrefix}/preview`, {
    method: 'POST',
    body: fd
  }).then(res => {
    console.log(`Received response: `, res);
    if (res.status == 200) {
      res.text().then(txt => {
        if (onReady) {
          onReady(JSON.parse(txt));
        } else {
          console.log(txt);
        }
      });
    } else if (res.status == 401) {
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
  }).then(html => console.log(html)).catch(err => console.error(err));
}
function showPreview(params) {
  if (!validate()) {
    return;
  }
  let button = document.getElementById("previewButton");
  button.classList.add('is-loading');
  button.disabled = true;
  const activateButton = function () {
    button.disabled = false;
    button.classList.remove('is-loading');
  };
  requestPreview(params, response => {
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
    let files = storage.files;
    let indices = [storage.mainImage];
    indices = indices.concat([...files.keys()].filter(k => k != storage.mainImage));
    for (i = 0; i < indices.length; i++) {
      const div = document.createElement('div');
      const img = document.createElement('img');
      img.classList.add('obj');
      div.appendChild(img);
      imgs.appendChild(div);
      if (i) {
        let span = document.createElement('span');
        span.innerText += "Komentarz " + i;
        div.prepend(span);
      }
      let reader = new FileReader();
      reader.onload = e => img.setAttribute("src", e.target.result);
      reader.readAsDataURL(files[indices[i]]);
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
  volume.value = configData.kinds[kind.selectedIndex].vol;
  volume.max = configData.kinds[kind.selectedIndex].max;
  volume.setAttribute('onchange', null);
  let volumeParent = volume.parentElement.parentElement;
  if (kind.selectedIndex == 0) {
    volumeParent.classList.remove("has-addons");
    volumeParent.children[1].classList.add("is-hidden");
    volume.parentElement.title = "Objętość oddanej krwi pełnej";
    volume.readOnly = false;
  } else {
    volumeParent.classList.add("has-addons");
    let descriptionBox = volumeParent.children[1];
    descriptionBox.classList.remove("is-hidden");
    let desc = descriptionBox.firstElementChild.firstElementChild;
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
  } else {
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
  Array.from(document.getElementsByClassName("createButton")).forEach(b => b.classList.add("is-loading"));
  let donations = document.getElementsByClassName("donation");
  let len = donations.length;
  let id = parseInt(donations[len - 1].getAttribute("donationId")) + 1;
  let XHR = new XMLHttpRequest();
  XHR.open('GET', `${urlPrefix}/donation/${id}`);
  XHR.responseType = "text";
  XHR.onload = () => {
    donations[len - 1].insertAdjacentHTML("afterend", XHR.response);
    let crs = Array.from(document.getElementsByClassName("createButton"));
    crs.forEach(b => {
      b.classList.remove("is-loading");
      b.classList.add("is-hidden");
    });
    crs[crs.length - 1].classList.remove("is-hidden");
    let dates = document.getElementsByClassName("donationDate");
    const t = today();
    dates[len].max = t;
    dates[len].value = t;
  };
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