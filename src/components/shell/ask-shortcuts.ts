function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    target.isContentEditable ||
    target.contentEditable === "true" ||
    target.getAttribute("contenteditable") === "true"
  );
}

export function shouldToggleAskFromKeyboardEvent(event: KeyboardEvent, target = event.target) {
  const commandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
  const slash = event.key === "/" && !isTextEntryTarget(target);

  return commandK || slash;
}
