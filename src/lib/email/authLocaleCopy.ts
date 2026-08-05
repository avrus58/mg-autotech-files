import type { TransactionalEmailLanguage } from "@/lib/email/types";

type ExtendedAuthLanguage = Exclude<TransactionalEmailLanguage, "de" | "en" | "tr">;

export type AuthTemplateCopy = {
  subject: string;
  title: string;
  intro: string;
  action?: string;
  footer: string;
};

type AuthVocabulary = {
  footer: string;
  confirm: [string, string, string];
  recovery: [string, string, string];
  invite: [string, string, string];
  magic: [string, string, string];
  emailChange: [string, string, string];
  reauth: [string, string];
  security: Record<string, [string, string]>;
};

const authCopy: Record<ExtendedAuthLanguage, AuthVocabulary> = {
  nl: {
    footer: "Hebt u dit niet aangevraagd, negeer dan deze e-mail of neem contact op met MG AutoTech.",
    confirm: ["E-mailadres bevestigen", "Bevestig uw e-mailadres om uw beveiligde MG AutoTech-account te activeren.", "E-mailadres bevestigen"],
    recovery: ["Nieuw wachtwoord instellen", "Er is een wachtwoordreset aangevraagd voor uw MG AutoTech-account.", "Wachtwoord resetten"],
    invite: ["Uw uitnodiging", "U bent uitgenodigd om een beveiligd MG AutoTech-account in te stellen.", "Uitnodiging accepteren"],
    magic: ["Veilig aanmelden", "Gebruik deze eenmalige link om veilig aan te melden bij MG AutoTech.", "Aanmelden"],
    emailChange: ["Nieuw e-mailadres bevestigen", "Bevestig {{ .NewEmail }} als het nieuwe adres voor uw MG AutoTech-account.", "Nieuw adres bevestigen"],
    reauth: ["Bevestig uw identiteit", "Gebruik de beveiligingscode om de gevoelige actie te bevestigen."],
    security: { password_changed: ["Uw wachtwoord is gewijzigd", "Het wachtwoord van uw MG AutoTech-account is gewijzigd."], email_changed: ["Uw e-mailadres is gewijzigd", "Het e-mailadres van uw MG AutoTech-account is gewijzigd."], phone_changed: ["Uw telefoonnummer is gewijzigd", "Het telefoonnummer van uw MG AutoTech-account is gewijzigd."], identity_linked: ["Aanmeldmethode gekoppeld", "Er is een nieuwe aanmeldmethode aan uw account gekoppeld."], identity_unlinked: ["Aanmeldmethode verwijderd", "Er is een aanmeldmethode uit uw account verwijderd."], mfa_factor_enrolled: ["Verificatiemethode toegevoegd", "Er is een verificatiemethode aan uw account toegevoegd."], mfa_factor_unenrolled: ["Verificatiemethode verwijderd", "Er is een verificatiemethode uit uw account verwijderd."] },
  },
  fr: {
    footer: "Si vous n'avez pas demandé cette action, ignorez cet e-mail ou contactez MG AutoTech.",
    confirm: ["Confirmer l'adresse e-mail", "Confirmez votre adresse e-mail pour activer votre compte MG AutoTech sécurisé.", "Confirmer l'adresse"], recovery: ["Définir un nouveau mot de passe", "Une réinitialisation du mot de passe a été demandée pour votre compte MG AutoTech.", "Réinitialiser le mot de passe"], invite: ["Votre invitation", "Vous êtes invité à créer un compte client MG AutoTech sécurisé.", "Accepter l'invitation"], magic: ["Connexion sécurisée", "Utilisez ce lien unique pour vous connecter en toute sécurité à MG AutoTech.", "Se connecter"], emailChange: ["Confirmer la nouvelle adresse", "Confirmez {{ .NewEmail }} comme nouvelle adresse de votre compte MG AutoTech.", "Confirmer l'adresse"], reauth: ["Confirmer votre identité", "Utilisez le code de sécurité pour confirmer l'action sensible demandée."],
    security: { password_changed: ["Votre mot de passe a été modifié", "Le mot de passe de votre compte MG AutoTech a été modifié."], email_changed: ["Votre adresse e-mail a été modifiée", "L'adresse e-mail de votre compte MG AutoTech a été modifiée."], phone_changed: ["Votre numéro a été modifié", "Le numéro de téléphone de votre compte MG AutoTech a été modifié."], identity_linked: ["Méthode de connexion ajoutée", "Une nouvelle méthode de connexion a été liée à votre compte."], identity_unlinked: ["Méthode de connexion supprimée", "Une méthode de connexion a été retirée de votre compte."], mfa_factor_enrolled: ["Méthode de vérification ajoutée", "Une méthode de vérification a été ajoutée à votre compte."], mfa_factor_unenrolled: ["Méthode de vérification supprimée", "Une méthode de vérification a été retirée de votre compte."] },
  },
  it: {
    footer: "Se non hai richiesto questa operazione, ignora l'e-mail o contatta MG AutoTech.",
    confirm: ["Conferma indirizzo e-mail", "Conferma il tuo indirizzo e-mail per attivare l'account MG AutoTech sicuro.", "Conferma e-mail"], recovery: ["Imposta una nuova password", "È stato richiesto il ripristino della password del tuo account MG AutoTech.", "Reimposta password"], invite: ["Il tuo invito", "Sei stato invitato a configurare un account cliente MG AutoTech sicuro.", "Accetta invito"], magic: ["Accesso sicuro", "Usa questo link monouso per accedere in modo sicuro a MG AutoTech.", "Accedi"], emailChange: ["Conferma nuova e-mail", "Conferma {{ .NewEmail }} come nuovo indirizzo del tuo account MG AutoTech.", "Conferma indirizzo"], reauth: ["Conferma la tua identità", "Usa il codice di sicurezza per confermare l'operazione richiesta."],
    security: { password_changed: ["La password è stata modificata", "La password del tuo account MG AutoTech è stata modificata."], email_changed: ["L'indirizzo e-mail è stato modificato", "L'indirizzo e-mail del tuo account MG AutoTech è stato modificato."], phone_changed: ["Il numero di telefono è stato modificato", "Il numero del tuo account MG AutoTech è stato modificato."], identity_linked: ["Metodo di accesso collegato", "Un nuovo metodo di accesso è stato collegato al tuo account."], identity_unlinked: ["Metodo di accesso rimosso", "Un metodo di accesso è stato rimosso dal tuo account."], mfa_factor_enrolled: ["Metodo di verifica aggiunto", "Un metodo di verifica è stato aggiunto al tuo account."], mfa_factor_unenrolled: ["Metodo di verifica rimosso", "Un metodo di verifica è stato rimosso dal tuo account."] },
  },
  es: {
    footer: "Si no solicitaste esta acción, ignora el correo o contacta con MG AutoTech.",
    confirm: ["Confirmar correo electrónico", "Confirma tu correo para activar tu cuenta segura de MG AutoTech.", "Confirmar correo"], recovery: ["Establecer nueva contraseña", "Se solicitó restablecer la contraseña de tu cuenta MG AutoTech.", "Restablecer contraseña"], invite: ["Tu invitación", "Has recibido una invitación para crear una cuenta segura de MG AutoTech.", "Aceptar invitación"], magic: ["Inicio de sesión seguro", "Usa este enlace de un solo uso para acceder de forma segura a MG AutoTech.", "Iniciar sesión"], emailChange: ["Confirmar nuevo correo", "Confirma {{ .NewEmail }} como nueva dirección de tu cuenta MG AutoTech.", "Confirmar dirección"], reauth: ["Confirma tu identidad", "Usa el código de seguridad para confirmar la acción solicitada."],
    security: { password_changed: ["Tu contraseña cambió", "La contraseña de tu cuenta MG AutoTech fue modificada."], email_changed: ["Tu correo cambió", "El correo electrónico de tu cuenta MG AutoTech fue modificado."], phone_changed: ["Tu teléfono cambió", "El teléfono de tu cuenta MG AutoTech fue modificado."], identity_linked: ["Método de acceso añadido", "Se vinculó un nuevo método de acceso a tu cuenta."], identity_unlinked: ["Método de acceso eliminado", "Se eliminó un método de acceso de tu cuenta."], mfa_factor_enrolled: ["Método de verificación añadido", "Se añadió un método de verificación a tu cuenta."], mfa_factor_unenrolled: ["Método de verificación eliminado", "Se eliminó un método de verificación de tu cuenta."] },
  },
  pt: {
    footer: "Se não pediu esta ação, ignore o e-mail ou contacte a MG AutoTech.",
    confirm: ["Confirmar endereço de e-mail", "Confirme o seu e-mail para ativar a conta segura MG AutoTech.", "Confirmar e-mail"], recovery: ["Definir nova palavra-passe", "Foi pedida uma reposição da palavra-passe da sua conta MG AutoTech.", "Repor palavra-passe"], invite: ["O seu convite", "Foi convidado a configurar uma conta segura MG AutoTech.", "Aceitar convite"], magic: ["Início de sessão seguro", "Use esta ligação única para entrar em segurança na MG AutoTech.", "Iniciar sessão"], emailChange: ["Confirmar novo e-mail", "Confirme {{ .NewEmail }} como novo endereço da sua conta MG AutoTech.", "Confirmar endereço"], reauth: ["Confirmar identidade", "Use o código de segurança para confirmar a ação pedida."],
    security: { password_changed: ["A palavra-passe foi alterada", "A palavra-passe da sua conta MG AutoTech foi alterada."], email_changed: ["O e-mail foi alterado", "O endereço de e-mail da sua conta MG AutoTech foi alterado."], phone_changed: ["O telefone foi alterado", "O telefone da sua conta MG AutoTech foi alterado."], identity_linked: ["Método de acesso associado", "Foi associado um novo método de acesso à sua conta."], identity_unlinked: ["Método de acesso removido", "Foi removido um método de acesso da sua conta."], mfa_factor_enrolled: ["Método de verificação adicionado", "Foi adicionado um método de verificação à sua conta."], mfa_factor_unenrolled: ["Método de verificação removido", "Foi removido um método de verificação da sua conta."] },
  },
  pl: {
    footer: "Jeśli nie zlecałeś tej operacji, zignoruj wiadomość lub skontaktuj się z MG AutoTech.",
    confirm: ["Potwierdź adres e-mail", "Potwierdź adres e-mail, aby aktywować bezpieczne konto MG AutoTech.", "Potwierdź e-mail"], recovery: ["Ustaw nowe hasło", "Poproszono o zresetowanie hasła do konta MG AutoTech.", "Zresetuj hasło"], invite: ["Twoje zaproszenie", "Zaproszono Cię do utworzenia bezpiecznego konta MG AutoTech.", "Przyjmij zaproszenie"], magic: ["Bezpieczne logowanie", "Użyj jednorazowego linku, aby bezpiecznie zalogować się do MG AutoTech.", "Zaloguj się"], emailChange: ["Potwierdź nowy e-mail", "Potwierdź {{ .NewEmail }} jako nowy adres konta MG AutoTech.", "Potwierdź adres"], reauth: ["Potwierdź tożsamość", "Użyj kodu bezpieczeństwa, aby potwierdzić żądaną operację."],
    security: { password_changed: ["Hasło zostało zmienione", "Hasło do konta MG AutoTech zostało zmienione."], email_changed: ["Adres e-mail został zmieniony", "Adres e-mail konta MG AutoTech został zmieniony."], phone_changed: ["Numer telefonu został zmieniony", "Numer telefonu konta MG AutoTech został zmieniony."], identity_linked: ["Dodano metodę logowania", "Nowa metoda logowania została połączona z kontem."], identity_unlinked: ["Usunięto metodę logowania", "Metoda logowania została usunięta z konta."], mfa_factor_enrolled: ["Dodano metodę weryfikacji", "Metoda weryfikacji została dodana do konta."], mfa_factor_unenrolled: ["Usunięto metodę weryfikacji", "Metoda weryfikacji została usunięta z konta."] },
  },
  ru: {
    footer: "Если вы не запрашивали это действие, проигнорируйте письмо или свяжитесь с MG AutoTech.",
    confirm: ["Подтвердите адрес почты", "Подтвердите адрес, чтобы активировать защищённый аккаунт MG AutoTech.", "Подтвердить адрес"], recovery: ["Установите новый пароль", "Запрошен сброс пароля для вашего аккаунта MG AutoTech.", "Сбросить пароль"], invite: ["Ваше приглашение", "Вас пригласили создать защищённый аккаунт MG AutoTech.", "Принять приглашение"], magic: ["Безопасный вход", "Используйте одноразовую ссылку для безопасного входа в MG AutoTech.", "Войти"], emailChange: ["Подтвердите новый адрес", "Подтвердите {{ .NewEmail }} как новый адрес вашего аккаунта MG AutoTech.", "Подтвердить адрес"], reauth: ["Подтвердите личность", "Используйте код безопасности для подтверждения запрошенного действия."],
    security: { password_changed: ["Пароль изменён", "Пароль вашего аккаунта MG AutoTech был изменён."], email_changed: ["Адрес почты изменён", "Адрес почты вашего аккаунта MG AutoTech был изменён."], phone_changed: ["Телефон изменён", "Номер телефона вашего аккаунта MG AutoTech был изменён."], identity_linked: ["Способ входа добавлен", "К аккаунту подключён новый способ входа."], identity_unlinked: ["Способ входа удалён", "Способ входа удалён из аккаунта."], mfa_factor_enrolled: ["Способ проверки добавлен", "К аккаунту добавлен способ проверки."], mfa_factor_unenrolled: ["Способ проверки удалён", "Способ проверки удалён из аккаунта."] },
  },
  zh: {
    footer: "如果并非您本人请求，请忽略此邮件或联系 MG AutoTech 支持。",
    confirm: ["确认电子邮箱", "请确认邮箱以启用您的 MG AutoTech 安全客户账户。", "确认邮箱"], recovery: ["设置新密码", "您的 MG AutoTech 账户收到密码重置请求。", "重置密码"], invite: ["您的邀请", "您已受邀创建 MG AutoTech 安全客户账户。", "接受邀请"], magic: ["安全登录", "请使用此一次性链接安全登录 MG AutoTech。", "登录"], emailChange: ["确认新邮箱", "请确认 {{ .NewEmail }} 为 MG AutoTech 账户的新邮箱。", "确认新邮箱"], reauth: ["确认您的身份", "请使用安全码确认所请求的敏感操作。"],
    security: { password_changed: ["密码已更改", "您的 MG AutoTech 账户密码已更改。"], email_changed: ["邮箱已更改", "您的 MG AutoTech 账户邮箱已更改。"], phone_changed: ["手机号已更改", "您的 MG AutoTech 账户手机号已更改。"], identity_linked: ["已添加登录方式", "您的账户已关联新的登录方式。"], identity_unlinked: ["已移除登录方式", "您的账户已移除一种登录方式。"], mfa_factor_enrolled: ["已添加验证方式", "您的账户已添加一种验证方式。"], mfa_factor_unenrolled: ["已移除验证方式", "您的账户已移除一种验证方式。"] },
  },
  sq: {
    footer: "Nëse nuk e kërkuat këtë veprim, shpërfilleni emailin ose kontaktoni MG AutoTech.",
    confirm: ["Konfirmoni emailin", "Konfirmoni emailin për të aktivizuar llogarinë e sigurt MG AutoTech.", "Konfirmo emailin"], recovery: ["Vendosni fjalëkalim të ri", "U kërkua rivendosja e fjalëkalimit për llogarinë tuaj MG AutoTech.", "Rivendos fjalëkalimin"], invite: ["Ftesa juaj", "Jeni ftuar të krijoni një llogari të sigurt MG AutoTech.", "Prano ftesën"], magic: ["Hyrje e sigurt", "Përdorni këtë lidhje njëpërdorimëshe për të hyrë në MG AutoTech.", "Hyr"], emailChange: ["Konfirmoni emailin e ri", "Konfirmoni {{ .NewEmail }} si adresën e re të llogarisë MG AutoTech.", "Konfirmo adresën"], reauth: ["Konfirmoni identitetin", "Përdorni kodin e sigurisë për të konfirmuar veprimin e kërkuar."],
    security: { password_changed: ["Fjalëkalimi u ndryshua", "Fjalëkalimi i llogarisë suaj MG AutoTech u ndryshua."], email_changed: ["Emaili u ndryshua", "Emaili i llogarisë suaj MG AutoTech u ndryshua."], phone_changed: ["Telefoni u ndryshua", "Numri i telefonit i llogarisë suaj u ndryshua."], identity_linked: ["Metoda e hyrjes u shtua", "Një metodë e re hyrjeje u lidh me llogarinë."], identity_unlinked: ["Metoda e hyrjes u hoq", "Një metodë hyrjeje u hoq nga llogaria."], mfa_factor_enrolled: ["Metoda e verifikimit u shtua", "Një metodë verifikimi u shtua në llogari."], mfa_factor_unenrolled: ["Metoda e verifikimit u hoq", "Një metodë verifikimi u hoq nga llogaria."] },
  },
};

function fromTuple(
  language: ExtendedAuthLanguage,
  tuple: [string, string, string]
): AuthTemplateCopy {
  return {
    subject: `MG AutoTech - ${tuple[0]}`,
    title: tuple[0],
    intro: tuple[1],
    action: tuple[2],
    footer: authCopy[language].footer,
  };
}

export function getExtendedAuthTemplateCopy(
  key: string,
  language: ExtendedAuthLanguage
): AuthTemplateCopy {
  const copy = authCopy[language];
  if (key === "confirm_signup") return fromTuple(language, copy.confirm);
  if (key === "password_recovery") return fromTuple(language, copy.recovery);
  if (key === "invite_user") return fromTuple(language, copy.invite);
  if (key === "magic_link") return fromTuple(language, copy.magic);
  if (key === "email_change") return fromTuple(language, copy.emailChange);
  if (key === "reauthentication") {
    return { subject: `MG AutoTech - ${copy.reauth[0]}`, title: copy.reauth[0], intro: copy.reauth[1], footer: copy.footer };
  }
  const security = copy.security[key] ?? ["MG AutoTech", copy.footer];
  return { subject: `MG AutoTech - ${security[0]}`, title: security[0], intro: security[1], footer: copy.footer };
}
