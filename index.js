import { stringify } from 'javascript-stringify'

import * as editorconfigs from './templates/editorconfigs.js'
import * as prettierrcs from './templates/prettierrcs.js'

// Use require because import assertions are only supported in Node.js 16
// This package still has to support Node.js 14 until it reaches EOL
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const versionMap = require('./package.json').devDependencies

const CREATE_ALIAS_SETTING_PLACEHOLDER = 'CREATE_ALIAS_SETTING_PLACEHOLDER'
export { CREATE_ALIAS_SETTING_PLACEHOLDER }

function stringifyJS (value, styleGuide) {
  // eslint-disable-next-line no-shadow
  const result = stringify(value, (val, indent, stringify, key) => {
    if (key === 'CREATE_ALIAS_SETTING_PLACEHOLDER') {
      return `(${stringify(val)})`
    }

    return stringify(val)
  }, 2)

  return result.replace(
    'CREATE_ALIAS_SETTING_PLACEHOLDER: ',
    `...require('@vue/eslint-config-${styleGuide}/createAliasSetting')`
  )
}

// This is also used in `create-vue`
export default function createConfig ({
  vueVersion = '3.x', // '2.x' | '3.x' (TODO: 2.7 / vue-demi)

  styleGuide = 'default', // default | airbnb | typescript
  hasTypeScript = false, // js | ts
  needsPrettier = false, // true | false

  additionalConfig = {}, // e.g. Cypress, createAliasSetting for Airbnb, etc.
  additionalDependenices = {} // e.g. eslint-plugin-cypress
}) {
  // This is the pkg object to extend
  const pkg = { devDependencies: {} }
  const addDependency = (name) => {
    pkg.devDependencies[name] = versionMap[name]
  }

  addDependency('eslint')
  addDependency('eslint-plugin-vue')

  if (styleGuide !== 'default' || hasTypeScript || needsPrettier) {
    addDependency('@rushstack/eslint-patch')
  }

  const language = hasTypeScript ? 'typescript' : 'javascript'

  const eslintConfig = {
    root: true,
    extends: [
      vueVersion.startsWith('2')
        ? 'plugin:vue/essential'
        : 'plugin:vue/vue3-essential'
    ]
  }
  const addDependencyAndExtend = (name) => {
    addDependency(name)
    eslintConfig.extends.push(name)
  }

  switch (`${styleGuide}-${language}`) {
    case 'default-javascript':
      eslintConfig.extends.push('eslint:recommended')
      break
    case 'default-typescript':
      eslintConfig.extends.push('eslint:recommended')
      addDependencyAndExtend('@vue/eslint-config-typescript')
      break
    case 'airbnb-javascript':
    case 'standard-javascript':
      addDependencyAndExtend(`@vue/eslint-config-${styleGuide}`)
      break
    case 'airbnb-typescript':
    case 'standard-typescript':
      addDependencyAndExtend(`@vue/eslint-config-${styleGuide}-with-typescript`)
      break
    default:
      throw new Error(`unexpected combination of styleGuide and language: ${styleGuide}-${language}`)
  }

  if (needsPrettier) {
    addDependency('prettier')
    addDependencyAndExtend('@vue/eslint-config-prettier')
  }

  Object.assign(pkg.devDependencies, additionalDependenices)

  function mergeESLintConfig (original, additional) {
    // Actually we need to do the same for `overrides` field
    // But in this package we don't have built-in `overrides`,
    // so I just omitted it for simplicity.
    const newExtends = [
      ...(original.extends ?? []),
      ...(additional.extends ?? [])
    ]

    return Object.assign(original, additional, { extends: newExtends })
  }
  mergeESLintConfig(eslintConfig, additionalConfig)

  const files = {
    '.eslintrc.cjs': ''
  }

  if (styleGuide === 'default') {
    // Both Airbnb & Standard have already set `env: node`
    files['.eslintrc.cjs'] += '/* eslint-env node */\n'

    // Both Airbnb & Standard have already set `ecmaVersion`
    // The default in eslint-plugin-vue is 2020, which doesn't support top-level await
    eslintConfig.parserOptions = {
      ecmaVersion: 'latest'
    }
  }

  if (pkg.devDependencies['@rushstack/eslint-patch']) {
    files['.eslintrc.cjs'] += "require('@rushstack/eslint-patch/modern-module-resolution')\n\n"
  }

  files['.eslintrc.cjs'] += `module.exports = ${stringifyJS(eslintConfig, styleGuide)}\n`

  // .editorconfig & .prettierrc.json
  if (editorconfigs[styleGuide]) {
    files['.editorconfig'] = editorconfigs[styleGuide]
  }
  if (needsPrettier && prettierrcs[styleGuide]) {
    files['.prettierrc.json'] = prettierrcs[styleGuide]
  }

  return {
    pkg,
    files
  }
}
