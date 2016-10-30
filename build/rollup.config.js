const buble = require('rollup-plugin-buble')
const nodeResolve = require('rollup-plugin-node-resolve')
import commonjs from 'rollup-plugin-commonjs';
const version = process.env.VERSION || require('../package.json').version

module.exports = {
  entry: 'src/index.js',
  dest: 'dist/soso-client.js',
  format: 'umd',
  moduleName: 'Soso',
  plugins: [
    nodeResolve({
      jsnext: true,
      main: true,
      browser: true,
    }),
    buble(),
    commonjs()
  ],
  banner: `/**
 * SoSo v${version}
 * (c) ${new Date().getFullYear()} Ruslan Ianberdin
 * @license MIT
 */`
}
