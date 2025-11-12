# lia-assistente-ia
Lia, uma assistente virtual full-stack (Python/Flask, JS). 🤖 Utiliza a API Google Gemini com contexto dinâmico de PDF (RAG). Apresenta um avatar de vídeo interativo, interface de nuvem de resposta, TTS/STT e sistema de gamificação. 

✨ Principais Funcionalidades
IA Conversacional (Google Gemini): Utiliza a API google-generativeai para gerar respostas fluidas e contextuais.

Contexto Dinâmico (RAG Simples): O back-end lê e processa um PDF (guia_metaday.pdf) usando PyPDF2 e scikit-learn (TF-IDF) para encontrar os trechos mais relevantes e usá-los como contexto para a IA, garantindo respostas precisas e baseadas no documento.

Avatar com Vídeo Dinâmico: A interface da Lia não é estática; ela usa dois vídeos (lia_idle.mp4 e lia_speaking.mp4) para alternar visualmente entre os estados de "ouvindo" e "falando".

Voz (TTS & STT): Integra a Web Speech API do navegador para funcionalidade completa de Text-to-Speech (Voz da Lia) e Speech-to-Text (Reconhecimento de Voz do usuário).

Interface Inovadora (Nuvem & Pílulas): Abandona o histórico de chat tradicional em favor de uma "nuvem de resposta" única e "pílulas" de histórico que mostram as últimas perguntas feitas.

Lógica de "Continuar": O back-end detecta respostas longas da IA, as divide, e envia um prompt de "Continuar", permitindo ao usuário ler respostas extensas em partes, sem quebrar o layout.

Gamificação & Login: Inclui um sistema de login VIP (baseado em CSV) e um sistema de pontos (armazenado em JSON) para engajamento.

Funcionalidade de Câmera: Permite que usuários VIP tirem uma foto e a recebam por e-mail (integrado com a API do SendGrid).

🛠️ Stack Tecnológica
Back-end
Python 3

Flask: Para o servidor web e a API REST.

Google Generative AI (google-generativeai): Para acesso aos modelos Gemini.

Scikit-learn (sklearn): Para vetorização TF-IDF e cálculo de similaridade de cosseno (busca no PDF).

PyPDF2: Para extração de texto do documento guia.

Front-end
HTML5

CSS3 (Customizado): Design responsivo "Mobile-First" e animações (@keyframes).

JavaScript (Vanilla JS): Para lógica de UI, controle de estado, chamadas fetch para a API, e integração com as APIs do navegador.

Web Speech API: Para SpeechSynthesis (TTS) e SpeechRecognition (STT).

🚀 Como Executar Localmente
Este projeto consiste em um back-end Flask e um front-end HTML/JS.

Pré-requisitos
Python 3.7+

Uma chave de API do Google AI Studio (para o Gemini).

(Opcional) Uma chave de API do SendGrid e um e-mail verificado (para a funcionalidade de foto).

1. Configuração do Back-end
Clone este repositório:

Bash

git clone [https://github.com/seu-usuario/portfolio-lia-ia-assistant.git](https://github.com/neemiassilva3/lia-ia-assistant.git)
cd portfolio-lia-ia-assistant
Crie e ative um ambiente virtual:

Bash

python -m venv venv
source venv/bin/activate  # No macOS/Linux
.\venv\Scripts\activate   # No Windows
Instale as dependências:

Bash

pip install -r requirements.txt 
(Nota: Talvez seja necessário criar um arquivo requirements.txt com as bibliotecas: flask, flask-cors, google-generativeai, scikit-learn, pypdf2, sendgrid, python-dotenv, numpy, uuid)

Crie um arquivo .env na raiz do projeto e adicione suas chaves:

GOOGLE_API_KEY="SUA_CHAVE_DO_GEMINI_AQUI"
SENDGRID_API_KEY="SUA_CHAVE_DO_SENDGRID_AQUI"
SENDER_EMAIL="seu_email_verificado@sendgrid.com"
Certifique-se de que os arquivos de dados estejam na raiz:

guia_metaday.pdf (O documento guia do evento)

cadastro.csv (Para os logins VIP)

Execute o servidor Flask:

Bash

python Lia.py
O back-end estará rodando em http://127.0.0.1:5000.

2. Acesso ao Front-end
O servidor Flask já está configurado para servir o arquivo unifyied.html.

Basta abrir seu navegador e acessar:

[http://127.0.0.1:5000](http://127.0.0.1:5000)
