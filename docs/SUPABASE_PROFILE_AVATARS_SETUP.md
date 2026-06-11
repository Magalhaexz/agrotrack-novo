# Configuração de fotos de perfil

Este documento descreve a configuração necessária para o bucket de fotos de perfil do HERDON.

## Bucket recomendado

- Nome: `profile-avatars`
- Tipo recomendado: público
- Finalidade: servir a foto de perfil diretamente para o aplicativo

### Por que público?

Fotos de perfil precisam aparecer no cabeçalho, no menu do usuário e na página de perfil sem exigir etapas extras de assinatura de URL.

Tradeoff:

- facilita a exibição imediata da imagem
- a leitura pública do arquivo fica mais simples
- o acesso de gravação continua restrito por política, então cada usuário só consegue alterar a própria foto

Se o bucket for privado, o aplicativo precisará gerar ou renovar URLs assinadas sempre que a foto for exibida. Isso aumenta a complexidade de atualização visual e de cache.

## Caminho usado pela aplicação

O arquivo é enviado usando um caminho restrito ao usuário autenticado:

```text
profile-avatars/{userId}/avatar.{ext}
```

Exemplo:

```text
profile-avatars/123e4567-e89b-12d3-a456-426614174000/avatar.jpg
```

O objeto final é salvo em `public.profiles.foto_url` como URL pública pronta para uso.

## Estrutura da coluna

- `public.profiles.foto_url` armazena a URL final da imagem
- o aplicativo usa essa coluna como fonte principal para mostrar a foto
- se a coluna estiver vazia, o app mostra um avatar com iniciais

## Políticas recomendadas

Crie políticas para o usuário autenticado acessar apenas o próprio diretório.

### Leitura

Permita leitura do bucket para o aplicativo exibir a foto.

### Gravação

Permita inserir ou atualizar apenas quando o caminho pertencer ao próprio usuário autenticado.

Exemplo de regra de caminho:

```sql
storage.foldername(name)[1] = auth.uid()::text
```

### Remoção

Permita remoção apenas para o próprio diretório do usuário.

## Regras de arquivo

- tipos aceitos: `JPG`, `JPEG`, `PNG` e `WEBP`
- tamanho máximo: 2 MB

## Como testar

1. Abra a página de perfil.
2. Envie uma imagem válida com menos de 2 MB.
3. Confirme que a foto aparece no cabeçalho e no menu do usuário.
4. Atualize a mesma foto com outro arquivo.
5. Confirme que a imagem é substituída sem quebrar o perfil.
6. Tente enviar um arquivo inválido.
7. Confirme que o aplicativo exibe a mensagem de validação em português.

## Solução de problemas

### A foto não envia

- confirme se o bucket existe
- confirme se o usuário está autenticado
- confirme se as políticas permitem gravação no próprio diretório
- confirme se o arquivo respeita o limite de tamanho

### Permissão negada

- verifique se a política está limitada ao próprio `auth.uid()`
- confirme se o caminho do arquivo segue o padrão `profile-avatars/{userId}/...`

### A imagem não aparece após o envio

- confirme se `public.profiles.foto_url` foi atualizado
- confirme se a URL salva na coluna aponta para a imagem correta
- tente recarregar a página para validar o cache do navegador

