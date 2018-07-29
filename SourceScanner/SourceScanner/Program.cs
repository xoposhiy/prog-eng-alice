﻿using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Yandex.Translator;

namespace SourceScanner
{
    internal class Program
    {
        private static readonly IYandexTranslator translator = 
            Yandex.Translator.Yandex.Translator(api =>
            api.ApiKey(File.ReadAllText("yandex-translator-apiKey.user"))
                .Format(ApiDataFormat.Json));
        private static void Main(string[] args)
        {
            var dir = args.Length > 0 ? args[0] : ".";
            var pattern = args.Length > 1 ? args[1] : "*.cs";
            var minCount = args.Length > 1 ? int.Parse(args[2]) : 2;
            var files = Directory.EnumerateFiles(dir, pattern, SearchOption.AllDirectories);
            //var words = files.SelectMany(GetWordsFromFile);
            //var words = GetNamesFrom(typeof(List<int>), typeof(Dictionary<int, int>));
            var words = GetNamesFrom(typeof(Enumerable));
            var lines = words
                .Where(w => w.word.Length > 2)
                .GroupBy(w => w.word)
                .OrderByDescending(g => g.Count())
                .Where(g => g.Count() > minCount)
                .Select(g =>
                {
                    Console.WriteLine(g.Key);
                    return g;
                })
                .Select(g => new
                {
                    frequency = g.Count(),
                    en = g.Key,
                    ru = Translate(g.Key),
                    example = GetExample(g),
                    hard = false
                }).ToArray();
            File.WriteAllText("enumerable.json", JsonConvert.SerializeObject(lines, Formatting.Indented));
        }

        private static IEnumerable<(string word, string exampleIdentifier)> GetWordsFromFile(string f)
        {
            var ws = SplitToWords(File.ReadAllText(f)).ToList();
            Console.WriteLine($"Found {ws.Distinct().Count()} words in  {Path.GetFileName(f)}");
            return ws;
        }

        private static IEnumerable<(string word, string exampleIdentifier)> GetNamesFrom(params Type[] types) =>
            types.SelectMany(GetNamesFrom);
        private static IEnumerable<(string word, string exampleIdentifier)> GetNamesFrom(Type type)
        {
            var namesFromMethods = type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static)
                .SelectMany(m => m.GetParameters().Select(p => p.Name).Concat(new[] { m.Name }));
            var namesFromProperties = type.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static)
                .Select(p => p.Name);
            return namesFromProperties.Concat(namesFromMethods).SelectMany(SplitToWords);
        }

        private static string GetExample(IEnumerable<(string word, string exampleIdentifier)> wordInfo)
        {
            var candidates = wordInfo
                .Where(item => item.exampleIdentifier.Length > item.word.Length)
                .OrderBy(item => item.exampleIdentifier.Length)
                .ToList();
            if (candidates.Any())
                return candidates[candidates.Count / 2].exampleIdentifier;
            return null;
        }

        private static string Translate(string engWord)
        {
            var translation = translator.Translate("ru", engWord);
            Console.WriteLine(translation.Text);
            return translation.Text.ToLower();
        }

        private static bool IsLatinLetter(char w)
        {
            var lower = char.ToLower(w);
            return lower >= 'a' && lower <= 'z';
        }

        private static IEnumerable<(string word, string exampleIdentifier)> SplitToWords(string content)
        {
            foreach (Match match in Regex.Matches(content, "[a-zA-Z]+"))
            {
                var identifier = match.Value;
                var words = Regex.Replace(identifier, "[A-Z]", m => " " + m.Value.ToLower())
                    .Split(new[] {' '}, StringSplitOptions.RemoveEmptyEntries);
                foreach (var word in words) yield return (word.ToLower(), identifier);
            }
        }

        private static IEnumerable<string> OldSplitToWords(string content)
        {
            var inSpaces = true;
            var word = new StringBuilder();
            for (var i = 0; i < content.Length; i++)
            {
                var ch = content[i];
                if (inSpaces)
                {
                    if (char.IsLetter(ch))
                    {
                        word.Append(ch);
                        inSpaces = false;
                    }
                }
                else
                {
                    if (char.IsLetter(ch))
                    {
                        if (char.IsLower(ch))
                        {
                            word.Append(ch);
                        }
                        else
                        {
                            yield return word.ToString();
                            word.Clear();
                            word.Append(ch);
                        }
                    }
                    else
                    {
                        yield return word.ToString();
                        word.Clear();
                        inSpaces = true;
                    }
                }
            }

            if (word.Length > 0)
                yield return word.ToString();
        }
    }
}