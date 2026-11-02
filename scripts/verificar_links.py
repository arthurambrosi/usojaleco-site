"""Verifica links e recursos locais; execute com o servidor HTTP ativo."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin,urlsplit,unquote,quote
from urllib.request import urlopen
import re,json,concurrent.futures

ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:8000/'
refs={}
def add(source,value,base=None):
    if not value or any(x in value for x in ['${','{{','<','>','\n']):return
    if value.startswith(('#','data:','javascript:','mailto:','tel:','blob:')):return
    url=urlsplit(urljoin(BASE+(base or source),value))
    if url.hostname not in ['127.0.0.1','localhost','www.usojaleco.com.br','usojaleco.com.br']:return
    path=unquote(url.path)
    refs.setdefault(path,set()).add(source)
class Parser(HTMLParser):
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        for k in ['href','src','poster','data-manifest']:
            if k in d:add(self.source,d[k])
        if d.get('srcset'):
            for item in d['srcset'].split(','):add(self.source,item.strip().split(' ')[0])
        if d.get('onclick'):
            for u in re.findall(r"window\.open\(['\"]([^'\"]+)",d['onclick']):add(self.source,u)
for p in ROOT.rglob('*'):
    if not p.is_file() or any(x in p.parts for x in ['.git','node_modules','__pycache__']):continue
    source=p.relative_to(ROOT).as_posix()
    if p.suffix=='.html':
        t=p.read_text('utf8');parser=Parser();parser.source=source;parser.feed(t)
        # Also visit pages that are not in the current navigation.
        add(source,'/'+source)
    elif p.suffix in ['.js','.css','.json']:
        t=p.read_text('utf8',errors='replace')
    else:continue
    if p.suffix=='.css':
        for u in re.findall(r'url\([\s\'"]*([^\)\'"\s]+)',t):add(source,u)
    if p.suffix in ['.js','.html']:
        for u in re.findall(r'''fetch\(\s*["']([^"']+)["']''',t):add(source,u,source if p.suffix=='.html' else (p.relative_to(ROOT).parent/'index.html').as_posix())
    if source.startswith('assets/data/'):
        for u in re.findall(r'''href:\s*["']([^"']+)["']''',t):add(source,u,'index.html')
    if source=='apresentações/data/manifest.json':
        for u in json.loads(t):add(source,u,'apresentações/index.html')
def check(path):
    try:
        with urlopen(BASE+quote(path.lstrip('/'),safe='/'),timeout=15) as r:
            if r.status!=200:return {'path':path,'status':r.status,'sources':sorted(refs[path])}
    except Exception as e:return {'path':path,'error':str(e),'sources':sorted(refs[path])}
broken=[x for x in concurrent.futures.ThreadPoolExecutor(12).map(check,sorted(refs)) if x]
print(json.dumps({'checked':len(refs),'broken':broken},ensure_ascii=False,indent=2))
raise SystemExit(bool(broken))
