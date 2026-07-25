const acorn = require('acorn');
try {
  acorn.parse("const arr = [ 'foo', ];", {ecmaVersion: 2020});
  console.log('Trailing comma OK');
  acorn.parse("const arr = [ 'foo', , ];", {ecmaVersion: 2020});
  console.log('Multiple commas OK');
  acorn.parse("const arr = [ 'foo', + ];", {ecmaVersion: 2020});
} catch(e) {
  console.log(e.message);
}
