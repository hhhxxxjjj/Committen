// Pets list orchestration: render list, handle "Use" → setActive → app restart.

const listEl = document.getElementById("pet-list");
const cancelBtn = document.getElementById("cancel-btn");

cancelBtn.addEventListener("click", () => window.committenPets.close());

(async () => {
  let response;
  try {
    response = await window.committenPets.list();
  } catch (err) {
    renderError(`Failed to load pets: ${err.message}`);
    return;
  }
  render(response);
})();

function render({ pets, activePet }) {
  listEl.innerHTML = "";
  if (!pets || pets.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No pets yet. Use the cat menu → Hatch from photo… to create one.";
    listEl.appendChild(empty);
    return;
  }

  for (const pet of pets) {
    const li = document.createElement("li");
    li.className = pet.id === activePet ? "pet-row is-active" : "pet-row";

    const thumb = document.createElement("img");
    thumb.className = "pet-thumb";
    thumb.src = pet.thumbnailUrl;
    thumb.alt = "";

    const meta = document.createElement("div");
    meta.className = "pet-meta";
    const name = document.createElement("div");
    name.className = "pet-name";
    name.textContent = pet.displayName;
    const tag = document.createElement("div");
    tag.className = "pet-tag";
    tag.textContent = pet.builtin ? "Default" : pet.type;
    meta.appendChild(name);
    meta.appendChild(tag);

    const btn = document.createElement("button");
    btn.dataset.id = pet.id;
    if (pet.id === activePet) {
      btn.disabled = true;
      btn.textContent = "Active";
    } else {
      btn.textContent = "Use";
      btn.addEventListener("click", () => onUse(pet, btn));
    }

    li.appendChild(thumb);
    li.appendChild(meta);
    li.appendChild(btn);
    listEl.appendChild(li);
  }
}

async function onUse(pet, btn) {
  const ok = confirm(`Switch to "${pet.displayName}"?\nCommitten will restart.`);
  if (!ok) return;
  btn.disabled = true;
  btn.textContent = "Restarting…";
  try {
    await window.committenPets.setActive(pet.id);
    // The app will relaunch; this window is about to die.
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Use";
    alert(`Switch failed: ${err.message}`);
  }
}

function renderError(msg) {
  listEl.innerHTML = "";
  const li = document.createElement("li");
  li.className = "empty-state";
  li.textContent = msg;
  listEl.appendChild(li);
}
