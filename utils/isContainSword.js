function removeDefinedSymbols(text, symbolsToRemove) {
  const regex = new RegExp(
    `[${symbolsToRemove.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}]`,
    "g"
  );
  return text.replace(regex, "");
}

const symbols = "!@#$%^&*()_+{}|:\"<>?~`-=[]\\;',./ ";

export const isContainSword = (text) => {
  const app = getApp();
  const swearWords = app.globalData.swear.map(
    (swear) => swear.name
  );

  let dealedText = text?removeDefinedSymbols(text, symbols).toLowerCase():"";

  for (let word of swearWords) {
    const regex = new RegExp(word, "gi");
    if (regex.test(dealedText)) {
      return true;
    }
  }
  return false;
};
