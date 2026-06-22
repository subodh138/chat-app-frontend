import { useState } from "react"
import Input from "../../components/Input"
import Button from "../../components/Input/Button"
import { useNavigate } from "react-router-dom"

const Form = ({
  isSignInPage = false,
}) => {
  // FIX 1: Corrected the condition to !isSignInPage so Sign Up includes the name field
  const [data, setData] = useState({
    ...(!isSignInPage && {
      fullName: ''
    }),
    email: '',
    password: ''
  });
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('Sending data :>> ', data);

    try {
      const res = await fetch(`https://chat-app-backend-my57.onrender.com/api/${isSignInPage ? 'login' : 'register'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (res.status === 400) {
        const errorText = await res.text();
        alert(errorText);
        return;
      }

      // FIX 2: Check if response is JSON (like login) or a Text string (like register)
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const resData = await res.json();
        console.log('JSON Response :>> ', resData);
        if (resData.token) {
          localStorage.setItem('user:token', resData.token);
          localStorage.setItem('user:detail', JSON.stringify(resData.user));
          navigate('/');
        }
      } else {
        const resText = await res.text();
        console.log('Text Response :>> ', resText);
        alert(resText); // Will alert "User registered successfully"
        if(res.status === 200 && !isSignInPage) {
          navigate('/users/sign_in'); // Redirect to login page on success
        }
      }

    } catch (err) {
      alert("Failed to connect to the live backend server. Please try again!");
    }
  }

  return (
    <div className='bg-light h-screen flex items-center justify-center'>
      <div className=" bg-white w-[500px] h-[600px] shadow-lg rounded-lg flex flex-col justify-center items-center">
          <div className=" text-4xl font-extrabold">Welcome {isSignInPage && 'Back'}</div>
          <div className="text-2xl font-light mb-14">{isSignInPage ? 'Sign in to get explored' : 'Sign up now to get started'}</div>

          <form className="flex flex-col items-center w-full" onSubmit={(e) => handleSubmit(e)}> 
          {!isSignInPage && 
              <Input label="Full Name" name="name" placeholder="Enter your full name" className="mb-6 w-[75%]" value={data.fullName || ''} onChange={(e) => setData({ ...data, fullName: e.target.value}) }/>
          }
          <Input label="Email Address" type="email" name="email" placeholder="Enter your email" className="mb-6 w-[75%]" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value}) }/>
          <Input label="Password" type="password" name="password" placeholder="Enter your Password" className="mb-10 w-[75%]" value={data.password} onChange={(e) => setData({ ...data, password: e.target.value}) }/>
          <Button type="submit" label={isSignInPage ? 'Sign-in' : 'Sign Up'} className="w-[75%] mb-2"/>
          </form>

          <div>{ isSignInPage ? "Didn't have an account?" : "Already have an account?"} <span className=" text-primary cursor-pointer underline" onClick={() => navigate(`/users/${isSignInPage ? 'sign_up' : 'sign_in'}`)}>{ isSignInPage ? 'sign-up' : 'Sign in'}</span></div>
      </div>
    </div >
  )
}

export default Form