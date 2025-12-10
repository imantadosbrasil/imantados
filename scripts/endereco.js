document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('enderecoForm');
    const cepInput = document.getElementById('cep');
    const numeroInput = document.getElementById('numero');
    const semNumeroCheckbox = document.getElementById('semNumero');
    const telefoneInput = document.getElementById('telefone');
    const infoAdicionalTextarea = document.getElementById('infoAdicional');
    const charCountSpan = document.getElementById('charCount');

    cepInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 5) {
            value = value.substring(0, 5) + '-' + value.substring(5, 8);
        }
        e.target.value = value;
    });

    cepInput.addEventListener('blur', function(e) {
        const cep = e.target.value.replace(/\D/g, '');
        if (cep.length === 8) {
            buscarCEP(cep);
        }
    });

    telefoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 0) {
            if (value.length <= 2) {
                value = '(' + value;
            } else if (value.length <= 6) {
                value = '(' + value.substring(0, 2) + ') ' + value.substring(2);
            } else if (value.length <= 10) {
                value = '(' + value.substring(0, 2) + ') ' + value.substring(2, 6) + '-' + value.substring(6);
            } else {
                value = '(' + value.substring(0, 2) + ') ' + value.substring(2, 7) + '-' + value.substring(7, 11);
            }
        }
        e.target.value = value;
    });

    semNumeroCheckbox.addEventListener('change', function(e) {
        if (e.target.checked) {
            numeroInput.value = '';
            numeroInput.disabled = true;
            numeroInput.required = false;
        } else {
            numeroInput.disabled = false;
            numeroInput.required = true;
        }
    });

    infoAdicionalTextarea.addEventListener('input', function(e) {
        const length = e.target.value.length;
        charCountSpan.textContent = length;
        
        if (length > 120) {
            charCountSpan.style.color = '#f23d4f';
        } else {
            charCountSpan.style.color = '#666';
        }
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (validarFormulario()) {
            const formData = coletarDadosFormulario();
            localStorage.setItem('enderecoEntrega', JSON.stringify(formData));
            window.location.href = '/revisar-endereco.html';
        }
    });

    async function buscarCEP(cep) {
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            
            if (!data.erro) {
                document.getElementById('rua').value = data.logradouro || '';
                document.getElementById('bairro').value = data.bairro || '';
                document.getElementById('cidade').value = data.localidade || '';
                document.getElementById('estado').value = data.uf || '';
                
                if (!data.logradouro) {
                    document.getElementById('complemento').focus();
                } else {
                    document.getElementById('numero').focus();
                }
            } else {
                alert('CEP não encontrado. Por favor, verifique o CEP digitado.');
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
        }
    }

    function validarFormulario() {
        let isValid = true;
        const requiredFields = form.querySelectorAll('[required]');
        
        requiredFields.forEach(field => {
            field.classList.remove('input-error');
            if (!field.value.trim()) {
                field.classList.add('input-error');
                isValid = false;
            }
        });

        const cep = cepInput.value.replace(/\D/g, '');
        if (cep.length !== 8) {
            cepInput.classList.add('input-error');
            isValid = false;
        }

        const telefone = telefoneInput.value.replace(/\D/g, '');
        if (telefone.length < 10) {
            telefoneInput.classList.add('input-error');
            isValid = false;
        }

        if (!isValid) {
            alert('Por favor, preencha todos os campos obrigatórios corretamente.');
        }

        return isValid;
    }

    function coletarDadosFormulario() {
        return {
            cep: cepInput.value,
            rua: document.getElementById('rua').value,
            numero: numeroInput.value,
            semNumero: semNumeroCheckbox.checked,
            complemento: document.getElementById('complemento').value,
            bairro: document.getElementById('bairro').value,
            cidade: document.getElementById('cidade').value,
            estado: document.getElementById('estado').value,
            infoAdicional: infoAdicionalTextarea.value,
            tipoEndereco: document.querySelector('input[name="tipoEndereco"]:checked').value,
            nome: document.getElementById('nome').value,
            telefone: telefoneInput.value
        };
    }

    function formatarCEP(cep) {
        return cep.replace(/(\d{5})(\d{3})/, '$1-$2');
    }
});
