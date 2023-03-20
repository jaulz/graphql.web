import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

import { parse, print as graphql_print } from 'graphql';
import { print } from '../printer';

function dedentString(string) {
  const trimmedStr = string
    .replace(/^\n*/m, '') //  remove leading newline
    .replace(/[ \t\n]*$/, ''); // remove trailing spaces and tabs
  // fixes indentation by removing leading spaces and tabs from each line
  let indent = '';
  for (const char of trimmedStr) {
    if (char !== ' ' && char !== '\t') {
      break;
    }
    indent += char;
  }

  return trimmedStr.replace(RegExp('^' + indent, 'mg'), ''); // remove indent
}

function dedent(strings, ...values) {
  let str = strings[0];
  for (let i = 1; i < strings.length; ++i) str += values[i - 1] + strings[i]; // interpolation
  return dedentString(str);
}

describe('print', () => {
  it('prints the kitchen sink document like graphql.js does', () => {
    const sink = JSON.parse(readFileSync(__dirname + '/kitchen_sink.json', { encoding: 'utf8' }));
    const doc = print(sink);
    expect(doc).toMatchSnapshot();
    expect(doc).toEqual(graphql_print(sink));
  });

  it('prints minimal ast', () => {
    const ast = {
      kind: 'Field',
      name: { kind: 'Name', value: 'foo' },
    };
    expect(print(ast as any)).toBe('foo');
  });

  // NOTE: The shim won't throw for invalid AST nodes
  it('returns empty strings for invalid AST', () => {
    const badAST = { random: 'Data' };
    expect(print(badAST as any)).toBe('');
  });

  it('correctly prints non-query operations without name', () => {
    const queryASTShorthanded = parse('query { id, name }');
    expect(print(queryASTShorthanded)).toBe(dedent`
      {
        id
        name
      }
    `);

    const mutationAST = parse('mutation { id, name }');
    expect(print(mutationAST)).toBe(dedent`
      mutation {
        id
        name
      }
    `);

    const queryASTWithArtifacts = parse('query ($foo: TestType) @testDirective { id, name }');
    expect(print(queryASTWithArtifacts)).toBe(dedent`
      query ($foo: TestType) @testDirective {
        id
        name
      }
    `);

    const mutationASTWithArtifacts = parse('mutation ($foo: TestType) @testDirective { id, name }');
    expect(print(mutationASTWithArtifacts)).toBe(dedent`
      mutation ($foo: TestType) @testDirective {
        id
        name
      }
    `);
  });

  it('prints query with variable directives', () => {
    const queryASTWithVariableDirective = parse(
      'query ($foo: TestType = {a: 123} @testDirective(if: true) @test) { id }'
    );
    expect(print(queryASTWithVariableDirective)).toBe(dedent`
      query ($foo: TestType = {a: 123} @testDirective(if: true) @test) {
        id
      }
    `);
  });

  it('keeps arguments on one line if line is short (<= 80 chars)', () => {
    const printed = print(parse('{trip(wheelchair:false arriveBy:false){dateTime}}'));

    expect(printed).toBe(
      dedent`
      {
        trip(wheelchair: false, arriveBy: false) {
          dateTime
        }
      }
    `
    );
  });
});
