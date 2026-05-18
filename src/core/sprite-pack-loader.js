// Sprite pack loader.
//
// A "pack" is a directory containing:
//   manifest.json — see validateManifest() for shape
//   *.png         — sprite strips (multi-frame) or single image (procedural)
//
// v0.2 P1: only multi-frame packs are wired end-to-end (the default cat).
// Procedural packs (for hatched pets) are validated here but rendered by P2.

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const REQUIRED_STATES = ["idle", "walk", "eat", "sleep", "attack"];

function loadPack(packDir) {
  const manifestPath = path.join(packDir, "manifest.json");

  let raw;
  try {
    raw = fs.readFileSync(manifestPath, "utf-8");
  } catch (e) {
    throw new Error(`pack manifest unreadable at ${manifestPath}: ${e.message}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (e) {
    throw new Error(`pack manifest invalid JSON at ${manifestPath}: ${e.message}`);
  }

  validateManifest(manifest, manifestPath);

  const imageUrls = {};
  if (manifest.type === "multi-frame") {
    for (const state of REQUIRED_STATES) {
      const rel = manifest.states[state].image;
      const abs = path.join(packDir, rel);
      if (!fs.existsSync(abs)) {
        throw new Error(
          `pack "${manifest.id}" missing image for state "${state}": ${abs}`
        );
      }
      imageUrls[state] = pathToFileURL(abs).href;
    }
  } else {
    const abs = path.join(packDir, manifest.baseImage);
    if (!fs.existsSync(abs)) {
      throw new Error(`pack "${manifest.id}" missing baseImage: ${abs}`);
    }
    imageUrls.base = pathToFileURL(abs).href;
  }

  return { manifest, imageUrls, packDir };
}

function validateManifest(m, source) {
  const fail = (msg) => {
    throw new Error(`pack manifest invalid (${source}): ${msg}`);
  };

  if (!m || typeof m !== "object") fail("not an object");
  if (typeof m.id !== "string" || !m.id) fail("id missing");
  if (typeof m.displayName !== "string") fail("displayName missing");
  if (m.type !== "multi-frame" && m.type !== "procedural") {
    fail(`type must be "multi-frame" or "procedural" (got ${JSON.stringify(m.type)})`);
  }
  if (
    !m.frameSize ||
    !Number.isFinite(m.frameSize.w) ||
    !Number.isFinite(m.frameSize.h)
  ) {
    fail("frameSize.{w,h} must be numbers");
  }
  if (m.displayScale !== undefined && !Number.isFinite(m.displayScale)) {
    fail("displayScale, if present, must be a number");
  }
  if (!m.states || typeof m.states !== "object") fail("states missing");

  if (m.type === "multi-frame") {
    for (const s of REQUIRED_STATES) {
      const st = m.states[s];
      if (!st) fail(`state "${s}" missing`);
      if (typeof st.image !== "string") fail(`state "${s}".image must be string`);
      if (!Number.isFinite(st.frames) || st.frames < 1) {
        fail(`state "${s}".frames must be a number >= 1`);
      }
      if (typeof st.duration !== "string" || !/^\d+(\.\d+)?s$/.test(st.duration)) {
        fail(`state "${s}".duration must look like "1.0s" (got ${JSON.stringify(st.duration)})`);
      }
    }
  } else {
    if (typeof m.baseImage !== "string") fail("procedural pack requires baseImage");
    for (const s of REQUIRED_STATES) {
      const st = m.states[s];
      if (!st) fail(`state "${s}" missing`);
      if (typeof st.procedural !== "string") {
        fail(`procedural state "${s}".procedural must be string`);
      }
    }
  }
}

module.exports = { loadPack, validateManifest, REQUIRED_STATES };
