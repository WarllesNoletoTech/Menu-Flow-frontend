import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactEmail, LegalPage } from '../../components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Exclusão de Dados | Menu Flow',
  description: 'Como solicitar acesso, correção ou exclusão dos seus dados pessoais no Menu Flow.',
  alternates: { canonical: 'https://www.menuflowapps.com/exclusao-de-dados' }
};

export default function DataDeletionPage() {
  return (
    <LegalPage title="Exclusão de Dados" summary="Saiba como solicitar a exclusão ou a revisão de informações pessoais associadas ao uso do Menu Flow.">
      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">1. Como solicitar</h2>
        <p>Para solicitar a exclusão, o acesso ou a correção de informações pessoais, envie um e-mail para <ContactEmail /> com o assunto <strong>“Solicitação de dados pessoais — Menu Flow”</strong>.</p>
        <p>Informe apenas o necessário para localizar o registro: nome utilizado, telefone ou e-mail associado à conta ou ao pedido, nome do estabelecimento envolvido (se houver) e o tipo de solicitação. Se possível, descreva aproximadamente quando utilizou o serviço.</p>
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="font-bold text-stone-900">Canal para solicitações</p>
          <p className="mt-2">E-mail: <ContactEmail /></p>
          <p className="mt-1 text-sm text-stone-600">Não envie senhas, tokens, documentos de identidade ou dados financeiros no primeiro contato.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">2. O que acontece após a solicitação</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Identificaremos os registros relacionados à solicitação e poderemos pedir uma confirmação de identidade proporcional à necessidade, por canal apropriado.</li>
          <li>Avaliaremos a natureza dos dados e qual participante é responsável pelo tratamento.</li>
          <li>Quando cabível, realizaremos a exclusão, anonimização, bloqueio ou correção, ou orientaremos o contato com o estabelecimento controlador.</li>
          <li>Informaremos o resultado ou os próximos passos pelo canal de contato utilizado, observados os prazos legais aplicáveis.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">3. Informações relacionadas a pedidos e lojas</h2>
        <p>Pedidos realizados em estabelecimentos cadastrados podem envolver dados necessários à operação da loja, ao atendimento, à entrega e ao cumprimento de obrigações legais. Em parte desses casos, o estabelecimento é responsável por decidir sobre a conservação e a exclusão dos registros; o Menu Flow poderá prestar apoio técnico de acordo com suas atribuições.</p>
        <p>O encerramento de uma conta ou a solicitação de exclusão não significa que todos os registros tenham de ser eliminados imediatamente: a legislação pode exigir ou autorizar a manutenção de determinados dados para obrigações fiscais, segurança ou exercício regular de direitos.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">4. WhatsApp e serviços externos</h2>
        <p>Se você conversou com um estabelecimento pelo WhatsApp, sua solicitação ao Menu Flow diz respeito aos dados tratados pela nossa plataforma. A remoção de mensagens ou informações mantidas diretamente pela Meta/WhatsApp ou por outros prestadores pode depender dos mecanismos disponibilizados por esses serviços e das responsabilidades de cada participante.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-stone-900">5. Outros direitos e informações</h2>
        <p>Você também pode exercer outros direitos previstos na LGPD, como confirmação de tratamento, acesso, correção, informação sobre compartilhamento e revogação de consentimento quando aplicável. Veja a <Link href="/politica-de-privacidade" className="font-semibold text-primary underline underline-offset-4">Política de Privacidade</Link> para mais detalhes.</p>
        <p>Para conhecer orientações públicas sobre os direitos dos titulares, consulte a <a href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-4">Autoridade Nacional de Proteção de Dados (ANPD)</a>.</p>
      </section>
    </LegalPage>
  );
}
