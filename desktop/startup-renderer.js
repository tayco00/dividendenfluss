const title = document.querySelector("#startup-title");
const detail = document.querySelector("#startup-detail");
const progress = document.querySelector("#startup-progress");
const progressFill = document.querySelector(".progress-fill");
const percent = document.querySelector("#startup-percent");
const skip = document.querySelector("#startup-skip");

window.setDividendenflussStatus = (nextStatus) => {
  if (typeof nextStatus?.title === "string") title.textContent = nextStatus.title;
  if (typeof nextStatus?.detail === "string") detail.textContent = nextStatus.detail;

  if (typeof nextStatus?.progress === "number") {
    const value = Math.min(100, Math.max(0, Math.round(nextStatus.progress)));
    progress.classList.remove("indeterminate");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    progress.setAttribute("aria-valuenow", String(value));
    progressFill.style.width = `${value}%`;
    percent.textContent = `${value} %`;
  } else {
    progress.classList.add("indeterminate");
    progress.removeAttribute("aria-valuemin");
    progress.removeAttribute("aria-valuemax");
    progress.removeAttribute("aria-valuenow");
    progressFill.style.width = "";
    percent.textContent = nextStatus?.label || "Updateprüfung";
  }

  skip.hidden = nextStatus?.canSkip === false;
};

skip.addEventListener("click", () => {
  skip.disabled = true;
  window.dividendenflussDesktop?.skipStartupUpdate();
});
