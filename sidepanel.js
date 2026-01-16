// ==============================
// TARGET TAB (passed from background.js)
// ==============================

const params = new URLSearchParams(window.location.search);
const TARGET_TAB_ID = Number(params.get("tabId"));

// ==============================
// CONFIG
// ==============================

// ⚠️ PUT YOUR API KEY HERE (local use only)
const OPENAI_API_KEY = "sk-proj-xxx";

// GPT endpoint
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// ==============================
// UI ELEMENTS
// ==============================

const summarizeBtn = document.getElementById("summarizeBtn");
const selectBtn = document.getElementById("selectBtn");
const output = document.getElementById("output");
let selectedText = "";

// ==============================
// MESSAGE FROM PAGE (ELEMENT SELECTED)
// ==============================

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "ELEMENT_SELECTED") {
    selectedText = msg.text || "";
    output.textContent = selectedText;
    summarizeBtn.disabled = !selectedText;
  }
});

// ==============================
// SUMMARIZE FULL PAGE
// ==============================

summarizeBtn.addEventListener("click", async () => {
  if (!TARGET_TAB_ID) {
    output.textContent = "No target tab.";
    return;
  }

  output.textContent = "Reading page content...";

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: TARGET_TAB_ID },
      func: () => document.body.innerText
    });

    const text = results?.[0]?.result;
    if (!text) {
      output.textContent = "Could not read page content.";
      return;
    }
	summarizeBtn.disabled = false;
    output.textContent = "Sending content to GPT...";
    const summary = await summarizeWithGPT();
    output.innerHTML = summary;

  } catch (err) {
    output.textContent = "Error:\n" + err.message;
  }
});

// ==============================
// ELEMENT SELECTION MODE
// ==============================

selectBtn.addEventListener("click", async () => {
  if (!TARGET_TAB_ID) {
    output.textContent = "No target tab.";
    return;
  }

  output.textContent = "Click an element on the page...";

  try {
    await chrome.scripting.executeScript({
      target: { tabId: TARGET_TAB_ID },
      func: enableSelectionMode
    });
  } catch (err) {
    output.textContent = "Error:\n" + err.message;
  }
});

// ==============================
// PAGE-CONTEXT FUNCTION (INJECTED)
// ==============================

function enableSelectionMode() {
  let lastEl = null;

  function highlight(el) {
    el.style.outline = "2px solid red";
  }

  function unhighlight(el) {
    el.style.outline = "";
  }

  function onMouseOver(e) {
    if (lastEl) unhighlight(lastEl);
    lastEl = e.target;
    highlight(lastEl);
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const text = e.target.innerText || "";

    cleanup();

    chrome.runtime.sendMessage({
      type: "ELEMENT_SELECTED",
      text
    });
  }

  function cleanup() {
    document.removeEventListener("mouseover", onMouseOver, true);
    document.removeEventListener("click", onClick, true);
    if (lastEl) unhighlight(lastEl);
  }

  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("click", onClick, true);
}

// ==============================
// GPT CALL
// ==============================

async function summarizeWithGPT() {
  const truncated = selectedText.slice(0, 12000);

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5.2-chat-latest",
      messages: [
        { role: "system", content: "You are a concise summarizer. Summarize the content clearly in bullet points. Focus on key ideas, avoid fluff. Include a small simplified, human readable paragraph summary first, then write the rest as normal summary of the content. Use the html formatting instead of markdown." },
        { role: "user", content: truncated }
      ],
      max_completion_tokens: 2500
    })
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}\n\n${rawText}`
    );
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    throw new Error("Invalid JSON response:\n" + rawText);
  }

	const content =
	  data?.choices?.[0]?.message?.content ??
	  data?.choices?.[0]?.text ??
	  data?.output_text ??
	  data?.response?.output_text;

	if (content) return content;

	// show the full JSON so we can see what the API actually returned
	return "No content returned.\n\nRAW RESPONSE:\n" + JSON.stringify(data, null, 2);
}
