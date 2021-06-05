import typescript from '@rollup/plugin-typescript'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import babel from '@rollup/plugin-babel'
import { terser } from 'rollup-plugin-terser'

const babelOptions = {
  extensions: ['js', 'ts'],
  babelHelpers: 'bundled',
  presets: [
    [
      '@babel/preset-env',
      {
        targets: [
          '> 1%, not dead'
        ]
      }
    ]
  ]
}

export default [
  {
    input: './src/ts/fixed-bar.ts',
    output: [
      {
        name: 'FixedBar',
        file: './dist/fixed-bar.js',
        format: 'iife',
        sourcemap: 'inline',
      },
      {
        name: 'FixedBar',
        file: './dist/fixed-bar.min.js',
        format: 'iife',
        plugins: [
          terser()
        ]
      },
    ],
    external: ['intersection-observer'],
    plugins: [
      typescript(),
      babel(babelOptions),
      commonjs(),
      resolve(),
    ]
  },
  {
    input: './src/ts/fixed-bar.ts',
    output: [
      {
        name: 'FixedBar',
        file: './dist/fixed-bar.polyfilled.js',
        format: 'iife',
        sourcemap: 'inline',
      },
      {
        name: 'FixedBar',
        file: './dist/fixed-bar.polyfilled.min.js',
        format: 'iife',
        plugins: [
          terser()
        ]
      },
    ],
    plugins: [
      typescript(),
      babel(babelOptions),
      commonjs(),
      resolve(),
    ]
  },
  {
    input: './src/ts/fixed-bar.ts',
    output: {
      name: 'FixedBar',
      file: './dist/fixed-bar-module.js',
      format: 'esm',
      sourcemap: 'inline',
    },
    external: ['intersection-observer', 'wicg-inert'],
    plugins: [
      typescript(),
      babel(babelOptions),
      commonjs(),
      resolve(),
    ]
  }
]
