export const maskName = (name: string | null | undefined): string => {
  if (!name) return "**********";

  const maskWord = (word: string): string => {
    if (word.length <= 2) {
      return word.charAt(0) + "*****";
    }
    return word.substring(0, 2) + "*".repeat(word.length - 2);
  };

  return name.split(" ").map(maskWord).join(" ");
};

export const maskPhone = (phone: string | null | undefined): string => {
  if (!phone) return "(**) *****-****";

  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.length < 10) return "(**) *****-****";

  const ddd = cleaned.substring(0, 2);
  const lastFour = cleaned.substring(cleaned.length - 4);

  return `(${ddd}) *****-${lastFour}`;
};

export const maskEmail = (email: string | null | undefined): string => {
  if (!email || email.indexOf("@") < 1) return "***@***.***";

  const [localPart, domain] = email.split("@");

  const mask = (part: string) => {
    if (!part) return "***";
    const len = part.length;
    // Regras para ver mais caracteres reais, mantendo a contagem correta de '*'
    // len<=2: mostra 1, mascara o restante
    // 3-4: mostra 1 começo, 1 fim
    // 5-6: mostra 2 começo, 1 fim
    // >=7: mostra 3 começo, 2 fim
    let keepStart = 1;
    let keepEnd = 0;
    if (len <= 2) { keepStart = 1; keepEnd = 0; }
    else if (len <= 4) { keepStart = 1; keepEnd = 1; }
    else if (len <= 6) { keepStart = 2; keepEnd = 1; }
    else { keepStart = 3; keepEnd = 2; }

    const start = part.slice(0, keepStart);
    const end = keepEnd > 0 ? part.slice(-keepEnd) : "";
    const maskedCount = Math.max(0, len - keepStart - keepEnd);
    return `${start}${"*".repeat(maskedCount)}${end}`;
  };

  const domainParts = domain.split(".");
  const topLevelDomain = domainParts.pop() || "";
  const domainName = domainParts.join(".");

  return `${mask(localPart)}@${mask(domainName)}.${topLevelDomain}`;
};
