import fs from 'fs'

const tmp = fs.readFileSync('./dist/utils.js', 'utf8')

// Patch fontkit duplicate axisIndex:o
const tmp_ = tmp.replace('axisIndex:o,axisIndex:o', 'axisIndex:o')

fs.writeFileSync('./dist/utils.js', tmp_, 'utf8')

console.log('Patched `fontkit` duplicate axisIndex key.')
