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
  if (!email || email.indexOf("@") < 1) return "******@*****.***";

  const [localPart, domain] = email.split("@");

  const mask = (part: string) => {
    if (part.length <= 2) return part.charAt(0) + "****";
    return part.substring(0, 2) + "*".repeat(part.length - 2);
  };

  const domainParts = domain.split(".");
  const topLevelDomain = domainParts.pop() || "";
  const domainName = domainParts.join(".");

  return `${mask(localPart)}@${mask(domainName)}.${topLevelDomain}`;
};
