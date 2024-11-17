/**
 * Asynchronously fetches structured text data from a file, converts it to JSON format using parseTextToJson,
 * and returns the resulting JSON data. Logs an error message and returns an empty array if fetching fails.
 *
 * @returns {Promise<Array>} A promise that resolves to an array of JSON data entries.
 */
async function loadData() {
  try {
    const response = await fetch("data.txt");
    const textData = await response.text();
    const jsonData = parseTextToJson(textData);

    return jsonData;
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}

/**
 * Converts a block of structured text data into an array of JSON objects.
 * Each JSON object represents a single lexeme entry, with its senses and variants.
 * The structured text is assumed to be in a specific format, with each line
 * starting with a specific keyword that indicates the type of information on
 * the line, such as the lexeme, its senses, or its variants.
 *
 * @param {string} text The structured text data to be parsed.
 * @returns {Array} An array of JSON objects, each representing a single lexeme entry.
 */
function parseTextToJson(text) {
  const entries = [];
  let currentEntry = undefined;
  let currentSense = undefined;

  text.split("\n").forEach((line) => {
    line = line.trim(); // Clean up leading/trailing spaces

    if (line === "") {
      return;
    }

    if (line.startsWith("\\lx")) {
      if (currentEntry) {
        if (currentSense) {
          currentEntry.senses.push(currentSense); // Push previous sense if any
        }
        entries.push(currentEntry); // Push the previous entry if any
      }

      currentEntry = {
        lexeme: getVal(line),
        senses: [],
        variants: [],
      };
      currentSense = undefined; // Reset current sense for the new lexeme
    }

    if (currentEntry) {
      if (line.startsWith("\\va")) {
        currentEntry.variants.push(getVal(line));
      }

      if (line.startsWith("\\pdl")) {
        currentEntry.primary_dialect_label = line.substring(5).trim();
      }
      if (line.startsWith("\\pdv")) {
        currentEntry.primary_dialect_variant = line.substring(5).trim();
      }

      if (line.startsWith("\\sn")) {
        if (currentSense) {
          currentEntry.senses.push(currentSense); // Push previous sense if any
        }

        currentSense = { sense_number: getVal(line) };
      }
      if (currentSense) {
        if (line.startsWith("\\ps")) {
          currentSense.part_of_speech = getVal(line);
        }
        if (line.startsWith("\\ge")) {
          currentSense.gloss = getVal(line);
        }
        if (line.startsWith("\\so")) {
          currentSense.source = getVal(line);
        }
        if (line.startsWith("\\sd")) {
          currentSense.semantic_domain = getVal(line);
        }
        if (line.startsWith("\\de")) {
          currentSense.definition = getVal(line);
        }
      }
    }
  });

  // Push the last entry and sense after the loop ends
  if (currentSense) {
    currentEntry.senses.push(currentSense); // Push the last sense
  }
  if (currentEntry) {
    entries.push(currentEntry); // Push the last entry
  }
  return entries;
}

function getVal(line) {
  return line.substring(4).trim();
}

/**
 * Searches through the given JSON data and returns an array of entries that match the given query.
 * The query is searched for in the lexeme, gloss, and definition fields of each entry.
 * If the query is empty, an empty array is returned.
 *
 * @param {String} query The query to search for in the JSON data.
 * @param {Array} jsonData The JSON data to search through.
 * @returns {Array} An array of entries that match the given query.
 */
function searchEntries(query, jsonData) {
  if (!query) {
    return [];
  }

  let regexPattern;
  try {
    // Convert wildcard * to regex pattern .* and make the query case-insensitive
    regexPattern = new RegExp(query.replace(/\*/g, ".*"), "i");
  } catch (e) {
    console.error(e);
    return [];
  }

  const results = jsonData.filter((entry) => {
    if (!entry?.lexeme) {
      console.error("No lexeme found:", entry);
      return false;
    }

    const lexemeMatches = regexPattern.test(entry.lexeme);
    const senseMatches = entry.senses.some((sense) => {
      if (!sense?.gloss && !sense?.definition) {
        return false;
      }

      return (
        (sense.gloss && regexPattern.test(sense.gloss)) ||
        (sense.definition && regexPattern.test(sense.definition))
      );
    });

    return lexemeMatches || senseMatches;
  });

  return results;
}

function displayResults(results) {
  const resultsContainer = document.getElementById("results");
  resultsContainer.innerHTML = "";

  if (results.length === 0) {
    resultsContainer.innerHTML = "<div>No entries found.</div>";
    return;
  }
  console.log(results.length + " results found.");

  for (const entry of results) {
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("entry");

    const lexeme = document.createElement("div");
    lexeme.classList.add("lexeme");
    lexeme.textContent = `Lexeme: ${entry.lexeme}`;
    entryDiv.appendChild(lexeme);

    entry.variants?.length &&
      entry.variants.forEach((variant) => {
        const variantDiv = document.createElement("div");
        variantDiv.classList.add("variant");
        variantDiv.textContent = `Variant: ${variant}`;
        entryDiv.appendChild(variantDiv);
      });

    if (entry.primary_dialect_label) {
      const primaryDialectLabel = document.createElement("div");
      // primaryDialectLabel.classList.add("primary-dialect-label");
      primaryDialectLabel.textContent = `Primary Dialect Label: ${
        entry.primary_dialect_label || ""
      }`;
      entryDiv.appendChild(primaryDialectLabel);
    }

    if (entry.primary_dialect_variant) {
      const primaryDialectVariant = document.createElement("div");
      // primaryDialectVariant.classList.add("primary-dialect-variant");
      primaryDialectVariant.textContent = `Primary Dialect Variant: ${
        entry.primary_dialect_variant || ""
      }`;
      entryDiv.appendChild(primaryDialectVariant);
    }

    if (entry.senses?.length) {
      for (const sense of entry.senses) {
        const senseDiv = document.createElement("div");
        senseDiv.classList.add("sense");
        senseDiv.innerHTML = `
        <div>Sense Number: ${sense.sense_number || ""}</div>
        <div>Part of Speech: ${sense.part_of_speech || ""}</div>
        <div>Gloss: ${sense.gloss || ""}</div>
        <div>Source: ${sense.source || ""}</div>
        <div>Semantic Domain: ${sense.semantic_domain || ""}</div>
        <div>Definition: ${sense.definition || ""}</div>
      `;
        entryDiv.appendChild(senseDiv);
      }
    }

    resultsContainer.appendChild(entryDiv);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const jsonData = await loadData();

  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase();
    const results = searchEntries(query, jsonData);
    displayResults(results);
  });

  document.getElementById("x-btn").addEventListener("click", () => {
    document.getElementById("search-input").value = "";
    displayResults([]);
  });
});
