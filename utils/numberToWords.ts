export function numberToWords(num: number): string {
  if (num === 0) return "ZERO NAIRA ONLY";

  const a = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const b = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  const convert = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        " hundred" +
        (n % 100 ? " and " + convert(n % 100) : "")
      );
    if (n < 1000000)
      return (
        convert(Math.floor(n / 1000)) +
        " thousand" +
        (n % 1000 ? " " + convert(n % 1000) : "")
      );
    if (n < 1000000000)
      return (
        convert(Math.floor(n / 1000000)) +
        " million" +
        (n % 1000000 ? " " + convert(n % 1000000) : "")
      );
    return n.toString();
  };

  const result = convert(num);
  return result.toUpperCase() + " NAIRA ONLY";
}