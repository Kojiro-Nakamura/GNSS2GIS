import re
import codecs

path = 'src/app/GNSSMappingApp.js'
with codecs.open(path, 'r', 'utf-8') as f:
    code = f.read()

# Replace the white fill for holes with 50% opacity
# There are two places: one in exportSVG and one in openPrintLayoutWindow
code = code.replace(
    'fill="#fff" stroke="none"',
    'fill="#fff" fill-opacity="0.5" stroke="none"'
)
code = code.replace(
    'fill=\\"#fff\\" stroke=\\"none\\"',
    'fill=\\"#fff\\" fill-opacity=\\"0.5\\" stroke=\\"none\\"'
)

# Replace the 0.9 opacity of the parcel background rectangle with 0.5
code = code.replace(
    'fill-opacity="0.9"',
    'fill-opacity="0.5"'
)
code = code.replace(
    'fill-opacity=\\"0.9\\"',
    'fill-opacity=\\"0.5\\"'
)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(code)

print('Patched opacity for areas and holes.')
