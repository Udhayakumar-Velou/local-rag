import sys
import zipfile
import xml.etree.ElementTree as ET

def extract(path):
    try:
        with zipfile.ZipFile(path) as z:
            xml_content = z.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            paragraphs = []
            for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                texts = [node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
                clean = ''.join(texts).strip()
                if clean:
                    paragraphs.append(clean)
            return '\n\n'.join(paragraphs)
    except Exception as e:
        return f"[DOCX Extraction Error: {e}]"

if __name__ == '__main__':
    if len(sys.argv) > 1:
        print(extract(sys.argv[1]))
