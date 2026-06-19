import io
import csv

def process_and_validate_data(dados: list, assunto: str, comentario: str, key_info: str, bu: str, usuario: str) -> str:
    """
    Valida os dados e aplica as regras de negócio para gerar o CSV final no formato V_PSA_BR_MANUAL_CLASSIFICATION.
    Retorna o conteúdo CSV como string se sucesso, ou levanta um ValueError se houver erro.
    """
    if not dados or len(dados) == 0:
        raise ValueError("A tabela está vazia. Insira os dados antes de enviar.")

    # Pega as chaves da primeira linha para verificar o número de colunas do arquivo base
    colunas_base = list(dados[0].keys())
    
    # 1. Validação: Número máximo de colunas
    if len(colunas_base) > 5:
        raise ValueError(f"O arquivo enviado contém {len(colunas_base)} colunas. O limite máximo permitido é 5 colunas (CONFIG_1 a CONFIG_5).")

    # 2. Montagem do Arquivo Final
    resultado = []
    bu_user_concat = f"{bu} - {usuario}" if usuario else bu
    
    for linha in dados:
        nova_linha = {
            'NAME': assunto,
            'COMMENT': comentario,
            'BU': bu_user_concat,
            'KEY_INFO': key_info
        }
        
        # Preenche CONFIG_1 a CONFIG_5
        for i in range(5):
            config_name = f'CONFIG_{i+1}'
            if i < len(colunas_base):
                coluna_atual = colunas_base[i]
                # Pega o valor, se for nulo ou vazio deixa vazio
                valor = linha.get(coluna_atual, "")
                nova_linha[config_name] = valor if valor is not None else ""
            else:
                nova_linha[config_name] = "N/A"
                
        # Status padrão
        nova_linha['STATUS'] = 1
        resultado.append(nova_linha)

    # 3. Exportação para CSV (String)
    csv_buffer = io.StringIO()
    # Garante a ordem exata das colunas
    fieldnames = ['NAME', 'COMMENT', 'BU', 'KEY_INFO', 'CONFIG_1', 'CONFIG_2', 'CONFIG_3', 'CONFIG_4', 'CONFIG_5', 'STATUS']
    writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames, delimiter=';')
    
    writer.writeheader()
    writer.writerows(resultado)
    
    return csv_buffer.getvalue()
