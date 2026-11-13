#!/usr/bin/env python3
"""Gera docs/relatorio/RELATORIO.pdf a partir do RELATORIO.md (ferramenta do autor, não do sistema).

Monta um HTML que renderiza o Markdown (marked) e os diagramas (mermaid) no navegador e imprime em
PDF com o Google Chrome em modo headless. Uso:  python3 docs/relatorio/gerar-pdf.py
Precisa de internet (carrega marked e mermaid de cdn.jsdelivr.net) e do google-chrome instalado.
"""
import html, pathlib, subprocess, sys

pasta = pathlib.Path(__file__).resolve().parent
md = (pasta / "RELATORIO.md").read_text(encoding="utf-8")
pagina = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório EJ Quest</title>
<style>
 @page {{ size: A4; margin: 18mm 16mm; }}
 body {{ font: 10.5pt/1.5 "Liberation Sans", Arial, sans-serif; color: #111; }}
 h1 {{ font-size: 20pt; border-bottom: 3px solid #e8590c; padding-bottom: 4px; }}
 h2 {{ font-size: 14.5pt; margin-top: 22px; border-bottom: 1px solid #ccc; break-after: avoid; }}
 h3 {{ font-size: 12pt; break-after: avoid; }}
 table {{ border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 9.5pt; break-inside: auto; }}
 th, td {{ border: 1px solid #bbb; padding: 4px 6px; vertical-align: top; text-align: left; }}
 th {{ background: #f3f0ec; }}
 tr {{ break-inside: avoid; }}
 code {{ font-family: "Liberation Mono", monospace; font-size: 9pt; background: #f4f4f4; padding: 0 3px; }}
 pre {{ background: #f6f6f6; border: 1px solid #ddd; padding: 8px; font-size: 8.5pt; white-space: pre-wrap; break-inside: avoid; }}
 pre code {{ background: none; }}
 .mermaid {{ text-align: center; margin: 10px 0; break-inside: avoid; }}
 hr {{ border: 0; border-top: 1px solid #ddd; }}
</style></head><body><div id="conteudo"></div>
<script id="md" type="text/markdown">{html.escape(md)}</script>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
<script>
 const texto = new DOMParser().parseFromString(document.getElementById('md').textContent, 'text/html').documentElement.textContent;
 document.getElementById('conteudo').innerHTML = marked.parse(texto);
 document.querySelectorAll('pre code.language-mermaid').forEach(c => {{
   const d = document.createElement('div'); d.className = 'mermaid'; d.textContent = c.textContent; c.parentElement.replaceWith(d);
 }});
 mermaid.initialize({{ startOnLoad: false, theme: 'neutral' }});
 mermaid.run();
</script></body></html>"""
html_saida = pasta / "relatorio.html"
html_saida.write_text(pagina, encoding="utf-8")
pdf = pasta / "RELATORIO.pdf"
cmd = ["google-chrome", "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
       "--virtual-time-budget=20000", f"--print-to-pdf={pdf}", html_saida.as_uri()]
r = subprocess.run(cmd, capture_output=True, text=True)
html_saida.unlink()
if r.returncode != 0 or not pdf.exists():
    sys.exit(f"falhou: {r.stderr[-500:]}")
print(f"PDF gerado: {pdf} ({pdf.stat().st_size // 1024} KB)")
