﻿using Newtonsoft.Json.Linq;
using System.IO;

namespace Serenity.Localization
{
    /// <summary>
    /// Contains helper methods for registration of local texts in hierarchical/dictionary formatted JSON files.
    /// </summary>
    public static class JsonLocalTextRegistration
    {
        /// <summary>
        /// Adds translation from a hierarchical local text dictionary parsed from JSON file.
        /// </summary>
        /// <param name="nested">Object parsed from local text JSON string</param>
        /// <param name="prefix">Prefix to prepend before local text keys</param>
        /// <param name="languageID">Language ID</param>
        /// <param name="registry">Registry</param>
        public static void AddFromNestedDictionary(IDictionary<string, JToken> nested, string prefix, string languageID, ILocalTextRegistry registry = null)
        {
            if (nested == null)
                throw new ArgumentNullException(nameof(nested));

            if (registry == null)
                throw new ArgumentNullException(nameof(registry));

            var target = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            ProcessNestedDictionary(nested, prefix, target);

            foreach (var pair in target)
                registry.Add(languageID, pair.Key, pair.Value);
        }

        /// <summary>
        /// Converts translation from a hierarchical local text dictionary to a simple dictionary.
        /// </summary>
        /// <param name="nested">Object parsed from local text JSON string</param>
        /// <param name="prefix">Prefix to prepend before local text keys</param>
        /// <param name="target">Target dictionary that will contain keys and translations</param>
        public static void ProcessNestedDictionary(IDictionary<string, JToken> nested, string prefix, Dictionary<string, string> target)
        {
            if (nested == null)
                throw new ArgumentNullException("nested");

            foreach (var k in nested)
            {
                var actual = prefix + k.Key;
                var o = k.Value;
                if (o is IDictionary<string, JToken> dictionary)
                    ProcessNestedDictionary(dictionary, actual + ".", target);
                else if (o != null && (!(o is JValue value) || value.Value != null))
                {
                    target[actual] = o.ToString();
                }
            }
        }

        /// <summary>
        /// Adds translations from JSON files at specified path. File names in this directory should be in format 
        /// {anyprefix}.{languageID}.json where {languageID} is a language code like 'en', 'en-GB' etc.
        /// </summary>
        /// <param name="path">Path containing JSON files</param>
        /// <param name="registry">Registry</param>
        public static void AddJsonTexts(this ILocalTextRegistry registry, string path)
        {
            if (path == null)
                throw new ArgumentNullException("path");

            if (!Directory.Exists(path))
                return;

            var files = Directory.GetFiles(path, "*.json", SearchOption.AllDirectories);
            Array.Sort(files);

            foreach (var file in files)
            {
                var texts = JsonConvert.DeserializeObject<Dictionary<string, JToken>>(File.ReadAllText(file).TrimToNull() ?? "{}");
                var langID = Path.GetFileNameWithoutExtension(Path.GetFileName(file));

                var idx = langID.LastIndexOf(".");
                if (idx >= 0)
                    langID = langID[(idx + 1)..];

                if (langID.ToLowerInvariant() == "invariant")
                    langID = "";

                AddFromNestedDictionary(texts, "", langID, registry);
            }
        }
    }
}