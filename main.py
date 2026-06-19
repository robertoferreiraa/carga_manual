from fastapi import FastAPI, Request, Form, File, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import csv
from io import StringIO
from datetime import datetime
import json
import traceback
import os
from pathlib import Path

from processor import process_and_validate_data
from sftp_client import send_csv_to_sftp

app = FastAPI(title="Opella Flow")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

BU_FILE = Path("bu_list.json")
DEFAULT_BU_LIST = ["CHC Analytics", "Marketing", "Comercial", "Operações", "Finanças"]


def load_bu_list() -> list:
    if BU_FILE.exists():
        try:
            return json.loads(BU_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return list(DEFAULT_BU_LIST)


def save_bu_list(bu_list: list) -> None:
    BU_FILE.write_text(json.dumps(bu_list, ensure_ascii=False, indent=2), encoding="utf-8")


bu_list = load_bu_list()


@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    current_user = os.environ.get("USERNAME", os.environ.get("USER", ""))
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "bu_list": bu_list, "current_user": current_user},
    )


@app.post("/upload")
async def handle_upload(
    assunto: str = Form(...),
    comentario: str = Form(""),
    key_info: str = Form(...),
    usuario: str = Form(...),
    bu_selecionada: str = Form(...),
    nova_bu: str = Form(""),
    modo: str = Form(...),
    arquivo: UploadFile = File(None),
    dados_manuais: str = Form(""),
):
    try:
        bu_final = nova_bu if bu_selecionada == "+ Cadastrar Nova BU" and nova_bu else bu_selecionada
        if not bu_final or bu_final == "+ Cadastrar Nova BU":
            return JSONResponse(status_code=400, content={"message": "Defina a Área (BU) corretamente."})

        if bu_final not in bu_list:
            bu_list.append(bu_final)
            save_bu_list(bu_list)

        dados_processar = []

        if modo == "upload":
            if not arquivo or not arquivo.filename:
                return JSONResponse(status_code=400, content={"message": "Nenhum arquivo enviado."})

            contents = await arquivo.read()
            text = contents.decode("utf-8", errors="ignore")

            if arquivo.filename.endswith(".csv"):
                try:
                    primeira_linha = text.split("\n")[0]
                    delimiter = ";" if ";" in primeira_linha else ","
                    reader = csv.DictReader(StringIO(text), delimiter=delimiter)
                    dados_processar = list(reader)
                except Exception as e:
                    return JSONResponse(status_code=400, content={"message": f"Erro ao ler CSV: {e}"})
            else:
                return JSONResponse(status_code=400, content={"message": "Por favor, envie um arquivo .csv"})

        elif modo == "manual":
            if not dados_manuais:
                return JSONResponse(status_code=400, content={"message": "Nenhum dado manual recebido."})
            try:
                dados_processar = json.loads(dados_manuais)
            except Exception as e:
                return JSONResponse(status_code=400, content={"message": f"Erro ao decodificar dados manuais: {e}"})
        else:
            return JSONResponse(status_code=400, content={"message": "Modo de inserção inválido."})

        if not dados_processar:
            return JSONResponse(status_code=400, content={"message": "A tabela está vazia. Nenhum dado para processar."})

        try:
            conteudo_csv = process_and_validate_data(
                dados=dados_processar,
                assunto=assunto,
                comentario=comentario,
                key_info=key_info,
                bu=bu_final,
                usuario=usuario,
            )
        except ValueError as ve:
            return JSONResponse(status_code=400, content={"message": str(ve)})

        data_hora = datetime.now().strftime("%Y%m%d_%H%M%S")
        nome_arquivo_final = f"MANUAL_CLASSIFICATION_{bu_final.replace(' ', '')}_{data_hora}.csv"

        try:
            sucesso = send_csv_to_sftp(conteudo_csv, nome_arquivo_final)
            if sucesso:
                return JSONResponse(
                    status_code=200,
                    content={"message": f"Arquivo {nome_arquivo_final} gerado e enviado para o pipeline com sucesso!"},
                )
            else:
                return JSONResponse(status_code=500, content={"message": "Falha desconhecida no envio SFTP."})
        except Exception as e:
            return JSONResponse(status_code=500, content={"message": f"Erro na conexão SFTP: {str(e)}"})

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": f"Erro interno do servidor: {str(e)}"})
