/** Convert SQLite-style placeholders without changing SQL literals or comments. */
export function toPgPlaceholders(sql: string): string {
  let output = "";
  let index = 0;

  for (let i = 0; i < sql.length;) {
    const current = sql[i];
    const next = sql[i + 1];

    if (current === "'" || current === '"' || current === "`") {
      const quote = current;
      const backslashEscapes = quote === "'" && /[eE]/.test(sql[i - 1] ?? "")
        && (i < 2 || !/[A-Za-z0-9_$]/.test(sql[i - 2]));
      output += current;
      i++;
      while (i < sql.length) {
        const char = sql[i];
        output += char;
        i++;
        if (backslashEscapes && char === "\\" && i < sql.length) {
          output += sql[i++];
        } else if (char === quote) {
          if (sql[i] === quote) output += sql[i++];
          else break;
        }
      }
      continue;
    }

    if (current === "-" && next === "-") {
      const end = sql.indexOf("\n", i + 2);
      const stop = end === -1 ? sql.length : end;
      output += sql.slice(i, stop);
      i = stop;
      continue;
    }

    if (current === "/" && next === "*") {
      const start = i;
      let depth = 0;
      while (i < sql.length) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth++;
          i += 2;
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          depth--;
          i += 2;
          if (depth === 0) break;
        } else {
          i++;
        }
      }
      output += sql.slice(start, i);
      continue;
    }

    if (current === "$") {
      const delimiter = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if (delimiter) {
        const end = sql.indexOf(delimiter, i + delimiter.length);
        const stop = end === -1 ? sql.length : end + delimiter.length;
        output += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }

    // PostgreSQL's JSON existence operators contain '?'. The single-character
    // form takes a text key, commonly a quoted literal.
    if (current === "?" && ((next === "|" || next === "&") || /^\?\s*'/.test(sql.slice(i)))) {
      output += current + next;
      i += 2;
      continue;
    }

    if (current === "?") {
      output += `$${++index}`;
      i++;
      continue;
    }

    output += current;
    i++;
  }

  return output;
}
