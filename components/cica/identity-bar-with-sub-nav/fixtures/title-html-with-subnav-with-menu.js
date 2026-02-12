const html = `
    <div class="moj-identity-bar moj-identity-bar--nested-moj-sub-navigation">
        <div class="moj-identity-bar__container">
            <section role="region" aria-label="Identity bar title">
                <div class="moj-identity-bar__details">
                    <span class="moj-identity-bar__title"><strong>CRN: 25-711111</strong></span>
                </div>
            </section>
            <nav class="moj-sub-navigation" aria-label="Sub navigation">
                <ul class="moj-sub-navigation__list">
                    <li class="moj-sub-navigation__item">
                        <a class="moj-sub-navigation__link" aria-current="page" href="/search">Search</a>
                    </li>
                    <li class="moj-sub-navigation__item">
                        <a class="moj-sub-navigation__link" href="/document">Documents</a>
                    </li>
                </ul>
            </nav>
            <div class="moj-identity-bar__actions">
                <div class="moj-identity-bar__menu">
                    <div class="moj-button-menu" data-module="moj-button-menu">
                        <a href="/download" role="button" draggable="false" class="govuk-button moj-button-menu__item govuk-button--secondary" data-module="govuk-button">Download</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;

export default html;
