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

  let localNumber = cleaned;

  if (localNumber.length > 11) {
    if (localNumber.startsWith("55") && (localNumber.length === 12 || localNumber.length === 13)) {
      // Strip Brazilian country code when present
      localNumber = localNumber.slice(2);
    }
    if (localNumber.length > 11) {
      localNumber = localNumber.slice(-11);
    }
  }

  if (localNumber.length < 10) return "(**) *****-****";

  const ddd = localNumber.slice(0, 2);
  const lastFour = localNumber.slice(-4);

  return `(${ddd}) *****-${lastFour}`;
};

export const maskEmail = (email: string | null | undefined): string => {
  if (!email || email.indexOf("@") < 1) return "***@***.***";

  const [localPart, domain] = email.split("@");

  const mask = (part: string) => {
    if (!part) return "***";
    const len = part.length;
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

export const maskCNPJ = (cnpj: string | null | undefined): string => {
  if (!cnpj) return "**.***.***/****-**";
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return "**.***.***/****-**";
  const start = digits.slice(0, 2);
  const end = digits.slice(-2);
  return `${start}.***.***/****-${end}`;
};
