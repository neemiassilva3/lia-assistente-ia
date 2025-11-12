import re 
import csv
import json
import os
import base64
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import (Mail, Attachment, FileContent, FileName, FileType, Disposition)
from dotenv import load_dotenv

# --- IMPORTAÇÕES PARA O PDF ---
import PyPDF2
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# --- IMPORTAÇÕES PARA O GEMINI E SELEÇÃO DE CHUNKS ---
import numpy as np
import google.generativeai as genai

load_dotenv() # Carrega as variáveis do arquivo .env (GOOGLE_API_KEY, etc.)

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app, resources={r"/*": {"origins": "*"}})

# --- INÍCIO: CONFIGURAÇÃO DA API DO GEMINI ---
GEMINI_CONFIGURADO = False
try:
    GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
    if GOOGLE_API_KEY:
        genai.configure(api_key=GOOGLE_API_KEY)
        GEMINI_CONFIGURADO = True
        print("✅ API do Google Gemini configurada com sucesso.")
    else:
        print("🚨 AVISO: GOOGLE_API_KEY não encontrada no .env. A IA Generativa usará o modo fallback (resposta direta do chunk).")
except Exception as e:
    print(f"🚨 ERRO ao configurar a API do Gemini: {e}")
# --- FIM: CONFIGURAÇÃO DA API DO GEMINI ---


# --- INÍCIO: LÓGICA DE PROCESSAMENTO DO PDF (COM AGRUPAMENTO POR TÓPICO) ---

PDF_CONTENT_CHUNKS = []
PDF_VECTORIZER = TfidfVectorizer()
PDF_TFIDF_MATRIX = None

def carregar_e_processar_pdf(caminho_do_pdf='guia_metaday.pdf'):
    """
    Esta função carrega o PDF, extrai o texto, agrupa as linhas por TÓPICO 
    e prepara os chunks para buscas.
    """
    global PDF_CONTENT_CHUNKS, PDF_VECTORIZER, PDF_TFIDF_MATRIX
    try:
        text = ""
        with open(caminho_do_pdf, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    # Adiciona uma quebra de linha simples para separar as linhas originais
                    text += page_text + "\n" 
        
        # 1. Divide em linhas e remove linhas vazias/espaços extras
        linhas_originais = text.split('\n')
        linhas_limpas = [linha.strip() for linha in linhas_originais if linha.strip()]

        if not linhas_limpas:
            print("🚨 ERRO: Não foi possível extrair linhas válidas do PDF.")
            return

        PDF_CONTENT_CHUNKS = []
        chunk_atual_linhas = [] # Lista temporária para guardar as linhas do chunk sendo montado

        # 2. Define palavras-chave que indicam o início de um novo tópico
        start_keywords = [
            "no térreo",
            "no segundo andar",
            "no terceiro andar",
            "a assistente virtual lia", 
            "projeto ela consciente", 
            "xxiii edição do startai", 
            "podcast ao vivo", 
            "projetos de consultoria", 
            "apresentarão dashboards", 
            "apresentações em formato de pitch", 
            "feira do empreendedor"
        ]

        # 3. Itera sobre as linhas para agrupar por tópico
        for linha in linhas_limpas:
            # Remove a tag ANTES de verificar as keywords e de adicionar
            linha_sem_source = re.sub(r'\\s*', '', linha).strip()
            if not linha_sem_source: # Pula se a linha ficar vazia após remover a tag
                continue

            linha_lower = linha_sem_source.lower() # Converte para minúsculas para checar keywords
            
            is_new_topic = any(linha_lower.startswith(keyword) for keyword in start_keywords)

            if is_new_topic and chunk_atual_linhas:
                # Finaliza o chunk anterior
                chunk_completo = "\n".join(chunk_atual_linhas).strip() # Junta as linhas SEM source
                if len(chunk_completo) > 10: 
                    PDF_CONTENT_CHUNKS.append(chunk_completo)
                
                # Começa um novo chunk com a linha atual (SEM source)
                chunk_atual_linhas = [linha_sem_source] 
            else:
                # Adiciona a linha (SEM source) ao chunk atual
                chunk_atual_linhas.append(linha_sem_source)

        # 4. Adiciona o último chunk que estava sendo montado
        if chunk_atual_linhas:
            chunk_completo = "\n".join(chunk_atual_linhas).strip()
            if len(chunk_completo) > 10:
                PDF_CONTENT_CHUNKS.append(chunk_completo)

        if not PDF_CONTENT_CHUNKS:
            print("🚨 ERRO: Não foi possível agrupar chunks por tópico. Verifique as keywords.")
            return

        # Vetorização
        PDF_VECTORIZER.fit(PDF_CONTENT_CHUNKS)
        PDF_TFIDF_MATRIX = PDF_VECTORIZER.transform(PDF_CONTENT_CHUNKS)
        
        print(f"✅ PDF '{caminho_do_pdf}' carregado e processado por TÓPICO. {len(PDF_CONTENT_CHUNKS)} chunks prontos.")
        
        # Descomente as linhas abaixo se quiser ver os chunks gerados no terminal
        # print("\n--- Chunks Gerados ---")
        # for i, chunk in enumerate(PDF_CONTENT_CHUNKS):
        #    print(f"Chunk {i+1}:\n{chunk}\n{'-'*20}")
        # print("----------------------\n")

    except FileNotFoundError:
        print(f"🚨 ERRO CRÍTICO: O arquivo PDF '{caminho_do_pdf}' não foi encontrado.")
    except Exception as e:
        print(f"🚨 ERRO CRÍTICO ao processar o PDF: {e}")

# --- FIM: LÓGICA DE PROCESSAMENTO DO PDF ---


@app.route('/')
def index():
    return render_template('index.html')

# --- ENDPOINT /chat ---
@app.route('/chat', methods=['POST'])
def chat():
    dados = request.json
    pergunta = dados.get('pergunta')

    if not pergunta:
        return jsonify({'resposta': 'Não entendi a sua pergunta.'}), 400

    if not PDF_CONTENT_CHUNKS or PDF_TFIDF_MATRIX is None:
        return jsonify({'resposta': 'Desculpe, minha base de conhecimento não está disponível.'}), 500

    # --- PASSO 1: BUSCA LOCAL (scikit-learn) ---
    pergunta_tfidf = PDF_VECTORIZER.transform([pergunta])
    similaridades = cosine_similarity(pergunta_tfidf, PDF_TFIDF_MATRIX)[0]
    indices_relevantes = np.argsort(similaridades)[-3:][::-1] # Top 3 chunks
    score_maximo = similaridades[indices_relevantes[0]]
    LIMITE_CONFIANCA = 0.1 

    if score_maximo < LIMITE_CONFIANCA:
        return jsonify({'resposta': "Não encontrei uma resposta para isso no meu guia. Pode tentar perguntar de outra forma?"})

    # --- PASSO 2: PREPARAÇÃO DO CONTEXTO PARA O GEMINI ---
    contexto = "\n---\n".join([PDF_CONTENT_CHUNKS[i] for i in indices_relevantes])

    # Adiciona a linha de print para debug (opcional)
    # print(f"\n--- CONTEXTO ENVIADO PARA GEMINI ---\n{contexto}\n-----------------------------------\n")

    # --- PASSO 3: GERAÇÃO (Gemini API) ---
    if not GEMINI_CONFIGURADO:
        print("🔁 API do Gemini não configurada. Usando fallback...")
        return jsonify({'resposta': PDF_CONTENT_CHUNKS[indices_relevantes[0]]}) # Retorna o melhor chunk

    prompt = f"""
    **Instrução Principal:** Você é Lia, assistente virtual do MetaDay. Responda à PERGUNTA DO USUÁRIO de forma **breve, direta e objetiva**. Extraia **apenas a informação essencial** do CONTEXTO para formar a resposta.

    **Regras Estritas:**
    1.  Baseie sua resposta **ESTRITAMENTE e APENAS** nas informações do CONTEXTO.
    2.  NÃO adicione informações externas, suposições ou opiniões.
    3.  NÃO use formatação especial (negrito **, itálico *, markdown, etc.). Responda em texto simples.
    4.  Se a informação necessária para responder à PERGUNTA DO USUÁRIO não estiver no CONTEXTO, responda EXATAMENTE: "Não encontrei essa informação específica no meu guia."
    5.  Responda em português do Brasil, em tom amigável, mas direto ao ponto.

    --- CONTEXTO ---
    {contexto}
    --- FIM DO CONTEXTO ---

    PERGUNTA DO USUÁRIO: "{pergunta}"

    RESPOSTA (breve e objetiva):
    """

    try:
        print(f"🧠 Enviando pergunta ao Gemini com {len(indices_relevantes)} chunks de contexto...")
        # Usa o nome de modelo correto
        model = genai.GenerativeModel('models/gemini-flash-latest') 
        response = model.generate_content(prompt)
        
        return jsonify({'resposta': response.text})

    except Exception as e:
        print(f"🚨 ERRO ao chamar a API do Gemini: {e}")
        print("🔁 Fallback: retornando o chunk mais relevante.")
        return jsonify({'resposta': PDF_CONTENT_CHUNKS[indices_relevantes[0]]}) # Retorna o melhor chunk


# --- LÓGICA DE LOGIN (VIPs) ---
def carregar_vips_do_csv():
    vips = {}
    try:
        with open('cadastro.csv', mode='r', encoding='utf-8') as infile:
            reader = csv.reader(infile)
            for row in reader:
                if row and len(row) >= 3:
                    token, name, email = row[0], row[1], row[2]
                    vips[token.strip().upper()] = {'name': name.strip(), 'email': email.strip()}
        print(f"✅ Arquivo de VIPs com e-mails carregado! {len(vips)} tokens.")
    except FileNotFoundError:
        print("🚨 ERRO: O arquivo 'cadastro.csv' não foi encontrado.")
    except Exception as e:
        print(f"🚨 ERRO ao ler o 'cadastro.csv': {e}.")
    return vips

VIPS_CADASTRADOS = carregar_vips_do_csv()
DADOS_USUARIOS_FILE = 'dados_usuarios.json'

@app.route('/login', methods=['POST'])
def login():
    dados = request.json
    token = dados.get('token', '').strip().upper()

    if token not in VIPS_CADASTRADOS:
        return jsonify({'valido': False})

    nome_vip = VIPS_CADASTRADOS[token]['name']
    
    try:
        with open(DADOS_USUARIOS_FILE, 'r', encoding='utf-8') as f:
            users_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        users_data = {}

    if token not in users_data:
        users_data[token] = {'loginCount': 0, 'totalPoints': 0, 'photoTaken': False}

    users_data[token]['loginCount'] += 1
    achievement_unlocked = False
    achievement_message = ''

    if users_data[token]['loginCount'] == 1:
        users_data[token]['totalPoints'] = 10
        achievement_unlocked = True
        achievement_message = '🎉 +10pts de Boas-vindas!'

    with open(DADOS_USUARIOS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users_data, f, indent=2, ensure_ascii=False)
    
    return jsonify({
        'valido': True, 'nome': nome_vip, 'totalPoints': users_data[token]['totalPoints'],
        'achievementUnlocked': achievement_unlocked, 'achievementMessage': achievement_message,
    })

# --- LÓGICA DE FOTO E E-MAIL ---
@app.route('/foto-lembranca', methods=['POST'])
def foto_lembranca():
    dados = request.json
    token = dados.get('token')
    image_data_b64 = dados.get('imageData')

    if not token or not image_data_b64:
        return jsonify({'sucesso': False, 'mensagem': 'Dados incompletos.'}), 400

    if token not in VIPS_CADASTRADOS:
        return jsonify({'sucesso': False, 'mensagem': 'Token inválido.'}), 403

    try:
        with open(DADOS_USUARIOS_FILE, 'r', encoding='utf-8') as f:
            users_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return jsonify({'sucesso': False, 'mensagem': 'Arquivo de dados não encontrado.'}), 500

    if token in users_data:
        achievement_unlocked = False
        achievement_message = ''
        
        if not users_data[token].get('photoTaken', False):
            users_data[token]['totalPoints'] += 20
            users_data[token]['photoTaken'] = True
            achievement_unlocked = True
            achievement_message = '🏆 Minha foto com a Lia +20pts'
        
        with open(DADOS_USUARIOS_FILE, 'w', encoding='utf-8') as f:
            json.dump(users_data, f, indent=2, ensure_ascii=False)
        
        print(f"📸 Foto recebida de {VIPS_CADASTRADOS[token]['name']}. Pontuação: {users_data[token]['totalPoints']}")
        
        enviar_email_com_foto(token, image_data_b64)

        return jsonify({
            'sucesso': True, 'novaPontuacao': users_data[token]['totalPoints'],
            'achievementUnlocked': achievement_unlocked, 'mensagem': achievement_message
        })
    else:
        return jsonify({'sucesso': False, 'mensagem': 'Usuário não encontrado.'}), 404

def enviar_email_com_foto(token, image_data_b64):
    api_key = os.environ.get('SENDGRID_API_KEY')
    sender_email = os.environ.get('SENDER_EMAIL')
    user_info = VIPS_CADASTRADOS.get(token)

    if not api_key or not sender_email:
        print("🚨 AVISO: SendGrid não configurado no .env. E-mail com foto não será enviado.")
        return
        
    if not user_info or not user_info.get('email'):
        print(f"🚨 ERRO: E-mail não encontrado para o token {token} no cadastro.csv.")
        return

    print(f"✉️ Tentando enviar e-mail para {user_info['email']}...")
    try:
        dados_puros_b64 = image_data_b64.split(',')[1]
        imagem_em_bytes = base64.b64decode(dados_puros_b64)

        message = Mail(
            from_email=sender_email,
            to_emails=user_info['email'],
            subject='Sua foto lembrança com a Lia do MetaDay!',
            html_content='<strong>Olá!</strong><br><br>Obrigado por interagir com a Lia. Conforme prometido, aqui está sua foto de recordação do nosso evento.<br><br>Até a próxima!'
        )
        attachedFile = Attachment(
            FileContent(base64.b64encode(imagem_em_bytes).decode()),
            FileName('foto-com-lia.png'), FileType('image/png'), Disposition('attachment')
        )
        message.attachment = attachedFile

        sendgrid_client = SendGridAPIClient(api_key)
        response = sendgrid_client.send(message)
        
        print(f"✅ E-mail com foto enviado com sucesso para {user_info['email']}, status: {response.status_code}")

    except Exception as e:
        print(f"🚨 ERRO CRÍTICO ao enviar e-mail com SendGrid: {e}")

if __name__ == '__main__':
    # Carrega o PDF na inicialização do servidor
    carregar_e_processar_pdf()
    app.run(debug=True, port=5000, use_reloader=False)