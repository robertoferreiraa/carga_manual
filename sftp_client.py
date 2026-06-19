import paramiko
import os
from dotenv import load_dotenv
import io

load_dotenv()

def send_csv_to_sftp(csv_content: str, filename: str) -> bool:
    use_mock = os.getenv('SFTP_MOCK', 'false').lower() == 'true'

    if use_mock:
        os.makedirs('mock_sftp_folder', exist_ok=True)
        with open(os.path.join('mock_sftp_folder', filename), 'w', encoding='utf-8') as f:
            f.write(csv_content)
        return True

    host = os.getenv('SFTP_HOST')
    port = int(os.getenv('SFTP_PORT', 22))
    username = os.getenv('SFTP_USER')
    key_path = os.getenv('SFTP_KEY_PATH', 'sftp_key.pem')
    remote_dir = os.getenv('SFTP_DIR', './')

    if not host or not username:
        raise Exception("SFTP_HOST e SFTP_USER devem estar configurados no .env")

    try:
        private_key = paramiko.RSAKey.from_private_key_file(key_path)
        transport = paramiko.Transport((host, port))
        transport.connect(username=username, pkey=private_key)

        sftp = paramiko.SFTPClient.from_transport(transport)
        remote_path = os.path.join(remote_dir, filename).replace('\\', '/')
        file_obj = io.BytesIO(csv_content.encode('utf-8'))
        sftp.putfo(file_obj, remote_path)
        sftp.close()
        transport.close()
        return True
    except Exception as e:
        raise Exception(f"Erro na conexão SFTP: {str(e)}")
